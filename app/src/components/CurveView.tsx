import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PitchTrack } from '../types'
import { PEAK_STEP } from '../types'
import { fmtTime } from './TopBar'

interface Props {
  pitch: PitchTrack
  peaks: Float32Array
  sr: number
  duration: number
  playhead: number
  playing: boolean
  selection: [number, number] | null
  onSeek: (t: number) => void
  onSelect: (range: [number, number] | null) => void
}

const GUTTER = 56, RULER = 28, WAVE = 40, TOP = 18, WAVE_GAP = 10
const MAX_PX_PER_SEC = 400
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11])
const hzToMidi = (f: number) => 69 + 12 * Math.log2(f / 440)
const noteName = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export function CurveView({ pitch, peaks, sr, duration, playhead, playing, selection, onSeek, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ start: 0, pxPerSec: 0 })   // pxPerSec 0 = 아직 폭을 모름
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null)
  const pointers = useRef(new Map<number, number>())            // pointerId → x
  const pinch = useRef<{ dist: number; pxPerSec: number; centerT: number } | null>(null)

  // 음높이 범위: 유성 프레임의 최소~최대에 위아래 2반음 여유, 최소 한 옥타브
  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < pitch.f0.length; i++) {
      const f = pitch.f0[i]
      if (f > 0) { const m = hzToMidi(f); if (m < lo) lo = m; if (m > hi) hi = m }
    }
    if (!isFinite(lo)) { lo = 55; hi = 67 }
    lo = Math.floor(lo) - 2; hi = Math.ceil(hi) + 2
    if (hi - lo < 12) { const pad = (12 - (hi - lo)) / 2; lo -= Math.floor(pad); hi += Math.ceil(pad) }
    return { lo, hi }
  }, [pitch])

  const plotW = Math.max(1, size.w - GUTTER)
  const fitPxPerSec = plotW / duration
  const pxPerSec = view.pxPerSec || fitPxPerSec
  const visible = plotW / pxPerSec

  const clampView = useCallback((start: number, pps: number) => {
    const p = Math.min(MAX_PX_PER_SEC, Math.max(fitPxPerSec, pps))
    const vis = plotW / p
    const s = Math.min(Math.max(0, duration - vis), Math.max(0, start))
    return { start: s, pxPerSec: p }
  }, [fitPxPerSec, plotW, duration])

  useEffect(() => {
    const el = host.current!
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 재생 헤드가 화면 밖으로 나가면 따라간다
  useEffect(() => {
    if (!playing) return
    if (playhead > view.start + visible * 0.98 || playhead < view.start)
      setView((v) => clampView(playhead - visible * 0.1, v.pxPerSec || fitPxPerSec))
  }, [playhead, playing, view.start, visible, clampView, fitPxPerSec])

  const xOf = useCallback((t: number) => GUTTER + (t - view.start) * pxPerSec, [view.start, pxPerSec])
  const tOf = useCallback((x: number) => view.start + (x - GUTTER) / pxPerSec, [view.start, pxPerSec])

  // ---------- 그리기 ----------
  useEffect(() => {
    const cv = canvas.current
    if (!cv || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(size.w * dpr); cv.height = Math.round(size.h * dpr)
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const w = size.w, h = size.h
    const plotBottom = h - RULER - WAVE - WAVE_GAP
    const { lo, hi } = range
    const yOf = (m: number) => plotBottom - (m - lo) / (hi - lo) * (plotBottom - TOP)
    const AMBER = css('--amber'), CYAN = css('--cyan'), MUTED = css('--muted'), FAINT = css('--faint')
    g.clearRect(0, 0, w, h)

    // 반음 격자
    const semiPx = (plotBottom - TOP) / (hi - lo)
    g.font = `11px ${css('--mono')}`
    g.textAlign = 'right'; g.textBaseline = 'middle'
    for (let m = lo; m <= hi; m++) {
      const nat = NATURAL.has(((m % 12) + 12) % 12)
      const y = Math.round(yOf(m)) + 0.5
      g.strokeStyle = nat ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.045)'
      g.lineWidth = 1
      g.beginPath(); g.moveTo(GUTTER, y); g.lineTo(w, y); g.stroke()
      const label = nat && (semiPx >= 9 || m % 12 === 0)
      if (label) { g.fillStyle = MUTED; g.fillText(noteName(m), GUTTER - 10, y) }
    }

    // 구간 선택
    if (selection) {
      const x0 = Math.max(GUTTER, xOf(selection[0])), x1 = Math.min(w, xOf(selection[1]))
      if (x1 > x0) {
        g.fillStyle = 'rgba(92,200,232,0.10)'; g.fillRect(x0, TOP - 8, x1 - x0, plotBottom - TOP + 8 + WAVE_GAP + WAVE)
        g.strokeStyle = 'rgba(92,200,232,0.5)'; g.beginPath(); g.moveTo(x0 + 0.5, TOP - 8); g.lineTo(x0 + 0.5, h - RULER); g.moveTo(x1 - 0.5, TOP - 8); g.lineTo(x1 - 0.5, h - RULER); g.stroke()
      }
    }

    // 음높이 곡선 (보이는 구간만)
    const { f0, times, hop } = pitch
    const t0 = view.start, t1 = view.start + visible
    const i0 = Math.max(0, Math.floor((t0 * sr - pitch.frame / 2) / hop) - 1)
    const i1 = Math.min(f0.length, Math.ceil((t1 * sr - pitch.frame / 2) / hop) + 2)
    const maxGap = hop * 3 / sr
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.save(); g.beginPath(); g.rect(GUTTER, 0, w - GUTTER, plotBottom + 4); g.clip()
    const path = new Path2D()
    let open = false, lastT = -1
    for (let i = i0; i < i1; i++) {
      const f = f0[i]
      if (f <= 0 || (open && times[i] - lastT > maxGap)) { open = false; if (f <= 0) continue }
      const x = xOf(times[i]), y = yOf(hzToMidi(f))
      if (!open) { path.moveTo(x, y); open = true } else path.lineTo(x, y)
      lastT = times[i]
    }
    g.strokeStyle = AMBER
    g.globalAlpha = 0.14; g.lineWidth = 7; g.stroke(path)
    g.globalAlpha = 1; g.lineWidth = 1.8; g.stroke(path)
    g.restore()

    // 파형 띠
    const wy = plotBottom + WAVE_GAP, mid = wy + WAVE / 2
    g.fillStyle = '#38505a'
    const samplesPerPx = sr / pxPerSec
    for (let x = GUTTER; x < w; x += 2) {
      const s0 = (t0 + (x - GUTTER) / pxPerSec) * sr
      const p0 = Math.floor(s0 / PEAK_STEP), p1 = Math.max(p0 + 1, Math.floor((s0 + samplesPerPx * 2) / PEAK_STEP))
      let m = 0
      for (let p = p0; p < p1 && p < peaks.length; p++) if (peaks[p] > m) m = peaks[p]
      const hh = Math.max(1, m * WAVE)
      g.fillRect(x, mid - hh / 2, 1.5, hh)
    }

    // 시간 눈금
    const ry = h - RULER + 0.5
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(GUTTER, ry); g.lineTo(w, ry); g.stroke()
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120]
    const step = steps.find((s) => s * pxPerSec >= 72) ?? 300
    g.textAlign = 'left'; g.fillStyle = FAINT; g.strokeStyle = MUTED
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const x = Math.round(xOf(t)) + 0.5
      g.beginPath(); g.moveTo(x, ry); g.lineTo(x, ry + 6); g.stroke()
      g.fillText(fmtTime(t), x + 5, ry + 15)
    }

    // 재생 헤드
    const px = xOf(playhead)
    if (px >= GUTTER && px <= w) {
      g.strokeStyle = CYAN; g.lineWidth = 1.5
      g.beginPath(); g.moveTo(px, TOP - 8); g.lineTo(px, h - RULER); g.stroke()
      g.fillStyle = CYAN; g.beginPath(); g.moveTo(px - 5, TOP - 10); g.lineTo(px + 5, TOP - 10); g.lineTo(px, TOP - 2); g.closePath(); g.fill()
    }
  }, [size, view, range, pitch, peaks, sr, duration, playhead, selection, visible, xOf, pxPerSec])

  // ---------- 입력 ----------
  const onPointerDown = (e: React.PointerEvent) => {
    const rect = host.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, x)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.abs(a - b), pxPerSec, centerT: tOf((a + b) / 2) }
      drag.current = null
      return
    }
    if (x < GUTTER) return
    drag.current = { x, t: tOf(x), moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const rect = host.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    pointers.current.set(e.pointerId, x)
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.abs(a - b) || 1
      const pps = pinch.current.pxPerSec * dist / pinch.current.dist
      const cx = (a + b) / 2
      const start = pinch.current.centerT - (cx - GUTTER) / Math.min(MAX_PX_PER_SEC, Math.max(fitPxPerSec, pps))
      setView(clampView(start, pps))
      return
    }
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(x - d.x) < 4) return
    d.moved = true
    const t = Math.min(duration, Math.max(0, tOf(x)))
    onSelect([Math.min(d.t, t), Math.max(d.t, t)])
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = drag.current
    drag.current = null
    if (d && !d.moved) { onSelect(null); onSeek(Math.min(duration, Math.max(0, d.t))) }
  }
  const onWheel = (e: React.WheelEvent) => {
    const rect = host.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (e.ctrlKey || e.metaKey) {           // 트랙패드 핀치 = ctrl+wheel
      const factor = Math.exp(-e.deltaY * 0.01)
      const tAt = tOf(x)
      const pps = Math.min(MAX_PX_PER_SEC, Math.max(fitPxPerSec, pxPerSec * factor))
      setView(clampView(tAt - (x - GUTTER) / pps, pps))
    } else {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      setView((v) => clampView(v.start + delta / pxPerSec, v.pxPerSec || fitPxPerSec))
    }
  }

  return (
    <div ref={host} className="curve" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      <canvas ref={canvas} />
      <div className="curve__hint">탭: 이동 · 드래그: 구간 · 두 손가락: 확대</div>
    </div>
  )
}
