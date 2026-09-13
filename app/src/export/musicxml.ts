// Score → MusicXML (내보내기 전용, 다시 읽지 않는다 — 기획서 8장). 시김새는 표준에 없어 v0.4 에서 별도 처리.
import type { Score, ScoreNote } from '../audio/rhythm'
import { NAMES, octaveOf, pitchClass } from '../music'

const DIV = 4   // 4분음표 = 4 division → 16분음표 = 1
const TYPE: Record<string, string> = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th' }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function noteXml(p: ScoreNote, unit: 8 | 16): string {
  const dur = (p.q1 - p.q0) * (16 / unit) * (DIV / 4)
  const tie = p.tieToNext ? '<tie type="start"/>' : ''
  const notations = p.tieToNext ? '<notations><tied type="start"/></notations>' : ''
  const pitch = p.midi === null ? '<rest/>' : (() => {
    const name = NAMES[pitchClass(p.midi)]
    const alter = name.endsWith('#') ? '<alter>1</alter>' : ''
    return `<pitch><step>${name[0]}</step>${alter}<octave>${octaveOf(p.midi)}</octave></pitch>`
  })()
  const dots = '<dot/>'.repeat(p.dots)
  return `<note>${pitch}<duration>${dur}</duration>${tie}<type>${TYPE[p.dur]}</type>${dots}${notations}</note>`
}

export function toMusicXML(score: Score, title: string): string {
  const { preset, unit, bpm } = score.grid
  const measures = score.bars.map((bar, i) => {
    const attrs = i === 0
      ? `<attributes><divisions>${DIV}</divisions><key><fifths>0</fifths></key><time><beats>${preset.num}</beats><beat-type>${preset.den}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>` +
        `<direction placement="above"><direction-type><metronome><beat-unit>${preset.beatEighths === 3 ? 'quarter' : 'quarter'}</beat-unit>${preset.beatEighths === 3 ? '<beat-unit-dot/>' : ''}<per-minute>${bpm}</per-minute></metronome></direction-type></direction>`
      : ''
    return `<measure number="${bar.number}">${attrs}${bar.notes.map((p) => noteXml(p, unit)).join('')}</measure>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>${esc(title)}</work-title></work>
<part-list><score-part id="P1"><part-name>해금</part-name></score-part></part-list>
<part id="P1">
${measures}
</part>
</score-partwise>
`
}
