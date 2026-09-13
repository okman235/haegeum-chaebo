// Score → MIDI. 양자화된 격자 시각을 쓴다(사람이 편집한 결과가 들어가게). 붙임줄로 이어진 조각은 한 음으로.
import { Midi } from '@tonejs/midi'
import type { Score } from '../audio/rhythm'

export function toMidi(score: Score, name: string): Uint8Array {
  const midi = new Midi()
  midi.name = name
  const { preset, bpm } = score.grid
  midi.header.setTempo(bpm * preset.beatEighths / 2)   // MIDI 템포는 4분음표 기준
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [preset.num, preset.den] })
  const track = midi.addTrack()
  track.name = '해금'
  const { unitSec } = score.info
  let open: { midi: number; q0: number } | null = null
  const q0 = score.bars[0]?.q0 ?? 0
  for (const bar of score.bars) for (const p of bar.notes) {
    if (p.midi === null) { open = null; continue }
    if (!open) open = { midi: p.midi, q0: p.q0 }
    if (!p.tieToNext) {
      track.addNote({ midi: open.midi, time: (open.q0 - q0) * unitSec, duration: (p.q1 - open.q0) * unitSec, velocity: 0.8 })
      open = null
    }
  }
  return midi.toArray()
}
