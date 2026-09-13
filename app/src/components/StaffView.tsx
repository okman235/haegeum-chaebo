// 오선보. 양자화된 Score(마디·음길이·쉼표·붙임줄)를 VexFlow 로 그린다.
// 렌더는 score 가 바뀔 때만 하고, 선택·재생 위치 강조는 DOM 클래스로만 바꾼다(재렌더 없음).
import { useEffect, useRef } from 'react'
import { Accidental, Beam, Dot, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice, type StemmableNote } from 'vexflow'
import type { Note } from '../audio/notes'
import type { Score } from '../audio/rhythm'
import { NAMES, octaveOf, pitchClass } from '../music'

interface Props {
  score: Score
  notes: Note[]
  selected: number | null
  playhead: number
  playing: boolean
  onSelectNote: (i: number) => void
}

const NOTE_W = 30, HEAD = 96, STAVE_Y = 22, HEIGHT = 130
const key = (m: number) => `${NAMES[pitchClass(m)].toLowerCase()}/${octaveOf(m)}`

export function StaffView({ score, notes, selected, playhead, playing, onSelectNote }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // ---------- 렌더 (score 가 바뀔 때만) ----------
  useEffect(() => {
    const el = host.current!
    el.innerHTML = ''
    if (score.bars.length === 0) return
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim()
    const faint = getComputedStyle(document.documentElement).getPropertyValue('--faint').trim()
    const widths = score.bars.map((b, i) => Math.max(70, b.notes.length * NOTE_W + 24) + (i === 0 ? HEAD : 0))
    const total = widths.reduce((a, b) => a + b, 10) + 20
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(total, HEIGHT)
    const ctx = renderer.getContext()
    ctx.setFillStyle(ink); ctx.setStrokeStyle(ink)
    const { preset } = score.grid
    const beamGroup = preset.beatEighths === 3 ? [new Fraction(3, 8)] : [new Fraction(1, 4)]
    let x = 10
    let prevPiece: { sn: StaveNote; tie: boolean } | null = null
    score.bars.forEach((bar, bi) => {
      const stave = new Stave(x, STAVE_Y, widths[bi])
      stave.setStyle({ fillStyle: ink, strokeStyle: ink })
      if (bi === 0) { stave.addClef('treble'); stave.addTimeSignature(`${preset.num}/${preset.den}`) }
      stave.setContext(ctx).draw()
      // 마디 번호 (못갖춘마디는 0 이하)
      ctx.save(); ctx.setFont('IBM Plex Mono, Menlo, monospace', 10); ctx.setFillStyle(faint)
      ctx.fillText(String(bar.number), x + (bi === 0 ? HEAD : 4), STAVE_Y - 4); ctx.restore()

      const vf = bar.notes.map((p, k) => {
        const rest = p.midi === null
        const sn = new StaveNote({ keys: [rest ? 'b/4' : key(p.midi!)], duration: p.dur + (rest ? 'r' : ''), dots: p.dots, autoStem: true })
        if (p.dots) Dot.buildAndAttach([sn], { all: true })
        if (!rest && NAMES[pitchClass(p.midi!)].endsWith('#')) sn.addModifier(new Accidental('#'), 0)
        sn.setStyle({ fillStyle: rest ? faint : ink, strokeStyle: rest ? faint : ink })
        if (!rest) sn.setAttribute('id', `n${p.noteIndex}-${bi}-${k}`)
        return sn
      })
      const voice = new Voice({ numBeats: preset.num, beatValue: preset.den }).setStrict(false).addTickables(vf)
      const beams = Beam.generateBeams(vf.filter((n) => !n.isRest()) as StemmableNote[], { groups: beamGroup, maintainStemDirections: false })
      new Formatter().joinVoices([voice]).format([voice], widths[bi] - (bi === 0 ? HEAD : 0) - 30)
      voice.draw(ctx, stave)
      beams.forEach((b) => b.setContext(ctx).draw())
      // 붙임줄: 앞 조각이 tieToNext 이면 이 조각과 잇는다
      bar.notes.forEach((p, k) => {
        if (prevPiece?.tie && p.midi !== null) new StaveTie({ firstNote: prevPiece.sn, lastNote: vf[k], firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
        prevPiece = p.midi === null ? null : { sn: vf[k], tie: p.tieToNext }
      })
      x += widths[bi]
    })
  }, [score])

  const groupsOf = (i: number) => host.current!.querySelectorAll(`g[id^="vf-n${i}-"]`)
  const reveal = (i: number, ratio: number) => {
    const g = groupsOf(i)[0] as SVGGElement | undefined
    const sc = scroller.current
    if (!g || !sc) return
    const bx = g.getBBox().x
    if (bx < sc.scrollLeft + 40 || bx > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, bx - sc.clientWidth * ratio)
  }

  // ---------- 강조: 선택 음 ----------
  useEffect(() => {
    const el = host.current!
    el.querySelectorAll('g.sel').forEach((g) => g.classList.remove('sel'))
    if (selected === null) return
    groupsOf(selected).forEach((g) => g.classList.add('sel'))
    reveal(selected, 0.3)
  }, [selected, score])

  // ---------- 강조: 재생 위치 (+따라가기) ----------
  useEffect(() => {
    const el = host.current!
    let i = -1
    let lo = 0, hi = notes.length - 1   // notes 는 시간순
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (notes[mid].start <= playhead) { i = mid; lo = mid + 1 } else hi = mid - 1 }
    if (i >= 0 && (notes[i].deleted || playhead >= notes[i].end + 0.15)) i = -1
    el.querySelectorAll('g.cur').forEach((g) => g.classList.remove('cur'))
    if (i < 0) return
    groupsOf(i).forEach((g) => g.classList.add('cur'))
    if (playing) reveal(i, 0.2)
  }, [playhead, playing, notes, score])

  const onClick = (e: React.MouseEvent) => {
    const g = (e.target as Element).closest('g[id^="vf-n"]')
    if (!g) return
    const i = Number(g.id.slice(4).split('-')[0])
    if (Number.isFinite(i)) onSelectNote(i)
  }

  return (
    <div ref={scroller} className="staff" onClick={onClick}>
      <div ref={host} className="staff__svg" />
      {score.bars.length === 0 && <div className="staff__empty">음을 찾지 못했습니다</div>}
    </div>
  )
}
