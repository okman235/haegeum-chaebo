import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PitchTrack } from '../types'
import { PEAK_STEP } from '../types'
import type { Note, Tuning } from '../audio/notes'
import type { Grid, GridInfo } from '../audio/rhythm'
import { NATURAL, hzToMidi, midiToHz, noteName } from '../music'
import { fmtTime } from './TopBar'

interface Props {
  pitch: PitchTrack
  peaks: Float32Array
  duration: number
  notes: Note[]
  tuning: Tuning
  selectedNote: number | null
  grid: Grid
  gridInfo: GridInfo
  playhead: number
  playing: boolean
  selection: [number, number] | null
  onSeek: (t: number) => void
  onSelect: (range: [number, number] | null) => void
  onSelectNote: (i: number) => void
}

const GUTTER = 56, RULER = 28, WAVE = 40, TOP = 18, WAVE_GAP = 10
const MAX_PX_PER_SEC = 400

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export function CurveView({ pitch, peaks, duration, notes, tuning, selectedNote, grid, gridInfo, playhead, playing, selection, onSeek, onSelect, onSelectNote }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ start: 0, pxPerSec: 0 })   // pxPerSec 0 = 아직 폭을 모름
  const drag = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null)
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

  // 오선보에서 고른 음이 화면 밖이면 그리로 옮긴다
  useEffect(() => {
    if (selectedNote === null) return
    const n = notes[selectedNote]
    if (!n) return
    if (n.start < view.start || n.end > view.start + visible)
      setView((v) => clampView(n.start - visible * 0.2, v.pxPerSec || fitPxPerSec))
    // view 는 일부러 뺀다: 선택이 바뀔 때만 따라가고, 사용자가 스크롤할 땐 안 잡아끈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote, notes])

  const xOf = useCallback((t: number) => GUTTER + (t - view.start) * pxPerSec, [view.start, pxPerSec])
  const tOf = useCallback((x: number) => view.start + (x - GUTTER) / pxPerSec, [view.start, pxPerSec])

  // 세로축은 A4=440 격자. 노트는 보정된 격자의 정수 midi 이므로 실제 주파수로 되돌려 자리를 잡는다
  const plotBottom = size.h - RULER - WAVE - WAVE_GAP
  const semiPx = (plotBottom - TOP) / (range.hi - range.lo)
  const yOf = useCallback((m: number) => plotBottom - (m - range.lo) / (range.hi - range.lo) * (plotBottom - TOP), [plotBottom, range])
  const bandMidi = useCallback((n: Note) => hzToMidi(midiToHz(n.midi, tuning.a4) * Math.pow(2, tuning.offsetCents / 1200)), [tuning])

  // ---------- 그리기 ----------
  useEffect(() => {
    const cv = canvas.current
    if (!cv || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(size.w * dpr); cv.height = Math.round(size.h * dpr)
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const w = size.w, h = size.h
    const { lo, hi } = range
    const AMBER = css('--amber'), CYAN = css('--cyan'), MUTED = css('--muted'), FAINT = css('--faint')
    g.clearRect(0, 0, w, h)

    // 반음 격자
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

    const t0 = view.start, t1 = view.start + visible

    // 리듬 격자: 박은 희미하게, 마디는 진하게 + 마디 번호. 칸이 6px 보다 촘촘하면 박선은 생략
    {
      const { unitSec, unitsPerBeat, unitsPerBar } = gridInfo
      const beatSec = unitSec * unitsPerBeat
      const showBeats = beatSec * pxPerSec >= 6
      const first = Math.floor((t0 - grid.anchor) / beatSec)
      g.font = `10px ${css('--mono')}`; g.textAlign = 'left'; g.textBaseline = 'top'
      for (let b = first; ; b++) {
        const t = grid.anchor + b * beatSec
        if (t > t1) break
        const isBar = ((b % (unitsPerBar / unitsPerBeat)) + (unitsPerBar / unitsPerBeat)) % (unitsPerBar / unitsPerBeat) === 0
        if (!isBar && !showBeats) continue
        const x = Math.round(xOf(t)) + 0.5
        if (x < GUTTER) continue
        g.strokeStyle = isBar ? 'rgba(92,200,232,0.35)' : 'rgba(255,255,255,0.07)'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(x, TOP - 8); g.lineTo(x, plotBottom + WAVE_GAP + WAVE); g.stroke()
        if (isBar) { g.fillStyle = 'rgba(92,200,232,0.7)'; g.fillText(String(Math.round(b / (unitsPerBar / unitsPerBeat)) + 1), x + 3, TOP - 6) }
      }
      g.textBaseline = 'middle'
    }

    // 노트 띠 (보이는 것만). 선택된 음은 청록
    const bandH = Math.max(4, semiPx * 0.9)
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      if (n.deleted || n.end < t0 || n.start > t1) continue
      const x0 = Math.max(GUTTER, xOf(n.start)), x1 = Math.min(w, xOf(n.end))
      const y = yOf(bandMidi(n))
      const sel = i === selectedNote
      g.fillStyle = sel ? 'rgba(92,200,232,0.45)' : 'rgba(242,180,90,0.30)'
      g.fillRect(x0, y - bandH / 2, Math.max(1.5, x1 - x0), bandH)
      if (!sel) { g.strokeStyle = 'rgba(242,180,90,0.55)'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y - bandH / 2 + 0.5, Math.max(1, x1 - x0 - 1), bandH - 1) }
      if (sel) { g.strokeStyle = CYAN; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y - bandH / 2 + 0.5, Math.max(1, x1 - x0 - 1), bandH - 1) }
    }

    // 음높이 곡선 (보이는 구간만)
    const { f0, times, hop, sr } = pitch
    const i0 = Math.max(0, Math.floor(t0 * sr / hop) - 1)
    const i1 = Math.min(f0.length, Math.ceil(t1 * sr / hop) + 2)
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
  }, [size, view, range, pitch, peaks, duration, playhead, selection, visible, xOf, pxPerSec, notes, selectedNote, plotBottom, semiPx, yOf, bandMidi, grid, gridInfo])

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
    drag.current = { x, y: e.clientY - rect.top, t: tOf(x), moved: false }
  }
  // 탭한 자리에 노트 띠가 있으면 그 음의 번호
  const noteAt = (t: number, y: number) => {
    const tol = Math.max(6, semiPx * 0.6)
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      if (!n.deleted && t >= n.start && t <= n.end && Math.abs(yOf(bandMidi(n)) - y) <= tol) return i
    }
    return -1
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
    if (d && !d.moved) {
      const i = noteAt(d.t, d.y)
      if (i >= 0) onSelectNote(i)
      else { onSelect(null); onSeek(Math.min(duration, Math.max(0, d.t))) }
    }
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
