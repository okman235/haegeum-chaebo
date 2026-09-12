// 오선보. 노트 모델을 VexFlow 로 그린다. v0.2 는 리듬 없이 골격 선율만 — 모두 4분음표, 마디 없음.
// 렌더는 노트가 바뀔 때만 하고, 선택·재생 위치 강조는 DOM 클래스로만 바꾼다(재렌더 없음).
import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import type { Note } from '../audio/notes'
import { NAMES, octaveOf, pitchClass } from '../music'

interface Props {
  notes: Note[]
  selected: number | null
  playhead: number
  playing: boolean
  onSelectNote: (i: number) => void
}

const PER_STAVE = 20, NOTE_W = 32, HEAD = 70, STAVE_Y = 22, HEIGHT = 130
const key = (m: number) => `${NAMES[pitchClass(m)].toLowerCase()}/${octaveOf(m)}`

export function StaffView({ notes, selected, playhead, playing, onSelectNote }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // ---------- 렌더 (노트가 바뀔 때만) ----------
  useEffect(() => {
    const el = host.current!
    el.innerHTML = ''
    if (notes.length === 0) return
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim()
    const chunks = Math.ceil(notes.length / PER_STAVE)
    const width = HEAD + chunks * PER_STAVE * NOTE_W + 20
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, HEIGHT)
    const ctx = renderer.getContext()
    ctx.setFillStyle(ink); ctx.setStrokeStyle(ink)
    let x = 10
    for (let c = 0; c < chunks; c++) {
      const slice = notes.slice(c * PER_STAVE, (c + 1) * PER_STAVE)
      const w = slice.length * NOTE_W + (c === 0 ? HEAD - 10 : 0)
      const stave = new Stave(x, STAVE_Y, w)
      stave.setStyle({ fillStyle: ink, strokeStyle: ink })
      if (c === 0) stave.addClef('treble')
      stave.setContext(ctx).draw()
      const vfNotes = slice.map((n, k) => {
        const sn = new StaveNote({ keys: [key(n.midi)], duration: 'q', autoStem: true })
        if (!NAMES[pitchClass(n.midi)].endsWith('#')) { /* 임시표 없음 */ } else sn.addModifier(new Accidental('#'), 0)
        sn.setStyle({ fillStyle: ink, strokeStyle: ink })
        sn.setAttribute('id', `n${c * PER_STAVE + k}`)
        return sn
      })
      const voice = new Voice({ numBeats: slice.length, beatValue: 4 }).setStrict(false).addTickables(vfNotes)
      new Formatter().joinVoices([voice]).format([voice], slice.length * NOTE_W - 12)
      voice.draw(ctx, stave)
      x += w
    }
  }, [notes])

  // ---------- 강조: 선택 음 ----------
  useEffect(() => {
    const el = host.current!
    el.querySelectorAll('g.sel').forEach((g) => g.classList.remove('sel'))
    if (selected !== null) el.querySelector(`#vf-n${selected}`)?.classList.add('sel')
  }, [selected, notes])

  // ---------- 강조: 재생 위치 (+따라가기) ----------
  useEffect(() => {
    const el = host.current!
    let i = -1
    // notes 는 시간순이라 이분 탐색
    let lo = 0, hi = notes.length - 1
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (notes[mid].start <= playhead) { i = mid; lo = mid + 1 } else hi = mid - 1 }
    if (i >= 0 && playhead >= notes[i].end + 0.15) i = -1
    el.querySelectorAll('g.cur').forEach((g) => g.classList.remove('cur'))
    if (i < 0) return
    const g = el.querySelector(`#vf-n${i}`) as SVGGElement | null
    if (!g) return
    g.classList.add('cur')
    const sc = scroller.current!
    if (playing || selected === i) {
      const bx = g.getBBox().x
      if (bx < sc.scrollLeft + 40 || bx > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, bx - sc.clientWidth * 0.2)
    }
  }, [playhead, playing, notes, selected])

  // 선택된 음이 바뀌면 보이게
  useEffect(() => {
    if (selected === null) return
    const g = host.current!.querySelector(`#vf-n${selected}`) as SVGGElement | null
    const sc = scroller.current
    if (!g || !sc) return
    const bx = g.getBBox().x
    if (bx < sc.scrollLeft + 40 || bx > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, bx - sc.clientWidth * 0.3)
  }, [selected])

  const onClick = (e: React.MouseEvent) => {
    const g = (e.target as Element).closest('g[id^="vf-n"]')
    if (!g) return
    const i = Number(g.id.slice(4))
    if (Number.isFinite(i)) onSelectNote(i)
  }

  return (
    <div ref={scroller} className="staff" onClick={onClick}>
      <div ref={host} className="staff__svg" />
      {notes.length === 0 && <div className="staff__empty">음을 찾지 못했습니다</div>}
    </div>
  )
}
