// Score → VexFlow SVG. 화면(StaffView, 한 줄로 길게)과 인쇄(여러 줄로 접음)가 같이 쓴다.
import { Accidental, Beam, Dot, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice, type StemmableNote } from 'vexflow'
import type { Score } from '../audio/rhythm'
import { NAMES, octaveOf, pitchClass } from '../music'

export interface RenderOptions {
  ink: string
  faint: string
  noteW?: number        // 음표 하나에 주는 폭
  wrapWidth?: number    // 주어지면 이 폭에서 줄을 바꾼다 (인쇄)
  lineGap?: number      // 줄 간격 (인쇄)
  ids?: boolean         // 음표 SVG 그룹에 id 를 붙일지 (화면 선택용)
}

const key = (m: number) => `${NAMES[pitchClass(m)].toLowerCase()}/${octaveOf(m)}`
// 줄 하나에 주는 세로 공간. 오선 위로 STAVE_TOP, 아래로 나머지 - 해금 음역(D3 덧줄 5개 ~ A5)이 잘리지 않게 넉넉히.
const HEAD = 96, STAVE_H = 210, STAVE_TOP = 64

/** 렌더한 SVG 의 전체 크기를 돌려준다 */
export function renderScore(el: HTMLDivElement, score: Score, o: RenderOptions): { width: number; height: number } {
  el.innerHTML = ''
  const noteW = o.noteW ?? 30
  const lineGap = o.lineGap ?? 40
  if (score.bars.length === 0) return { width: 0, height: 0 }
  const { preset } = score.grid
  const beamGroup = preset.beatEighths === 3 ? [new Fraction(3, 8)] : [new Fraction(1, 4)]

  // 마디 폭. 줄의 첫 마디에는 음자리표·박자표 머리가 붙는다
  const bodyW = score.bars.map((b) => Math.max(70, b.notes.length * noteW + 24))
  // 줄 나누기
  const lines: number[][] = []
  if (o.wrapWidth) {
    let cur: number[] = [], w = HEAD
    score.bars.forEach((_, i) => {
      if (cur.length && w + bodyW[i] > o.wrapWidth!) { lines.push(cur); cur = []; w = HEAD }
      cur.push(i); w += bodyW[i]
    })
    if (cur.length) lines.push(cur)
  } else lines.push(score.bars.map((_, i) => i))

  const width = o.wrapWidth ?? bodyW.reduce((a, b) => a + b, HEAD + 30)
  const height = lines.length * (STAVE_H + lineGap) - lineGap
  const renderer = new Renderer(el, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle(o.ink); ctx.setStrokeStyle(o.ink)

  let prevPiece: { sn: StaveNote; tie: boolean } | null = null
  lines.forEach((line, li) => {
    const y = STAVE_TOP + li * (STAVE_H + lineGap)
    // 인쇄면 줄 폭을 채우도록 마디를 늘린다
    const natural = line.reduce((a, i) => a + bodyW[i], HEAD)
    const stretch = o.wrapWidth && li < lines.length - 1 ? (o.wrapWidth - 10) / natural : 1
    let x = 10
    line.forEach((bi, k) => {
      const bar = score.bars[bi]
      const w = Math.round(bodyW[bi] * stretch) + (k === 0 ? HEAD : 0)
      const stave = new Stave(x, y, w)
      stave.setStyle({ fillStyle: o.ink, strokeStyle: o.ink })
      if (k === 0) { stave.addClef('treble'); if (li === 0) stave.addTimeSignature(`${preset.num}/${preset.den}`) }
      stave.setContext(ctx).draw()
      ctx.save(); ctx.setFont('IBM Plex Mono, Menlo, monospace', 10); ctx.setFillStyle(o.faint)
      ctx.fillText(String(bar.number), x + (k === 0 ? HEAD : 4), y - 4); ctx.restore()

      const vf = bar.notes.map((p, n) => {
        const rest = p.midi === null
        const sn = new StaveNote({ keys: [rest ? 'b/4' : key(p.midi!)], duration: p.dur + (rest ? 'r' : ''), dots: p.dots, autoStem: true })
        if (p.dots) Dot.buildAndAttach([sn], { all: true })
        if (!rest && NAMES[pitchClass(p.midi!)].endsWith('#')) sn.addModifier(new Accidental('#'), 0)
        sn.setStyle({ fillStyle: rest ? o.faint : o.ink, strokeStyle: rest ? o.faint : o.ink })
        if (!rest && o.ids) sn.setAttribute('id', `n${p.noteIndex}-${bi}-${n}`)
        return sn
      })
      const voice = new Voice({ numBeats: preset.num, beatValue: preset.den }).setStrict(false).addTickables(vf)
      const beams = Beam.generateBeams(vf.filter((n) => !n.isRest()) as StemmableNote[], { groups: beamGroup, maintainStemDirections: false })
      new Formatter().joinVoices([voice]).format([voice], w - (k === 0 ? HEAD : 0) - 30)
      voice.draw(ctx, stave)
      beams.forEach((b) => b.setContext(ctx).draw())
      bar.notes.forEach((p, n) => {
        if (prevPiece?.tie && p.midi !== null) new StaveTie({ firstNote: prevPiece.sn, lastNote: vf[n], firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
        prevPiece = p.midi === null ? null : { sn: vf[n], tie: p.tieToNext }
      })
      x += w
    })
  })
  // 화면(한 줄)에서는 실제 그려진 범위에 맞춰 세로를 꼭 맞춘다 - 음역이 좁으면 낮게, 넓으면 높게. 가로 축척은 그대로.
  if (!o.wrapWidth) {
    const svg = el.querySelector('svg')
    if (svg && svg.isConnected) {
      const bb = svg.getBBox()
      if (bb.height > 0) {
        const pad = 6
        const h = Math.ceil(bb.height + pad * 2)
        svg.setAttribute('viewBox', `0 ${Math.floor(bb.y - pad)} ${width} ${h}`)
        svg.setAttribute('height', String(h))
        svg.style.height = `${h}px`
        return { width, height: h }
      }
    }
  }
  return { width, height }
}
