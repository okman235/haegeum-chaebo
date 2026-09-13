/**
 * 리듬 양자화. 자동 박 추적은 없다(기획서 6.2) — 장단 프리셋 × BPM × 첫 박(앵커)으로 격자를 깔고 노트를 스냅한다.
 *
 * 격자 단위(unit)는 8분음표(8) 또는 16분음표(16). 모든 위치·길이는 앵커 기준 격자 칸 수(정수)로 다룬다.
 * 출력은 마디별 음표·쉼표 열이고, 마디를 넘는 음은 잘라서 붙임줄(tie)로 잇는다.
 */
import type { Note } from './notes'

/** 장단 프리셋. 박자표는 기획서 6.2 의 기억값 — 확인 필요, 아들이 고치면 여기만 바꾼다. */
export interface Jangdan {
  id: string
  name: string
  num: number          // 박자표 분자
  den: number          // 박자표 분모
  beatEighths: number  // 한 박이 8분음표 몇 개인가 (12/8 은 점4분 = 3, 12/4 는 4분 = 2)
}

export const JANGDAN: Jangdan[] = [
  { id: 'jinyang', name: '진양조', num: 18, den: 8, beatEighths: 3 },
  { id: 'jungmori', name: '중모리', num: 12, den: 4, beatEighths: 2 },
  { id: 'jungjung', name: '중중모리', num: 12, den: 8, beatEighths: 3 },
  { id: 'jajin', name: '자진모리', num: 12, den: 8, beatEighths: 3 },
  { id: 'hwimori', name: '휘모리', num: 4, den: 4, beatEighths: 2 },
  { id: 'free', name: '자유 (4/4)', num: 4, den: 4, beatEighths: 2 },
]

export interface Grid {
  preset: Jangdan
  unit: 8 | 16         // 격자 = 8분 또는 16분
  bpm: number          // 한 박(preset.beatEighths 개의 8분음표) 이 분당 몇 번
  anchor: number       // 첫 마디 첫 박의 시각(초)
}

export interface GridInfo {
  unitSec: number      // 격자 한 칸(초)
  unitsPerBeat: number
  unitsPerBar: number
}

export function gridInfo(g: Grid): GridInfo {
  const unitsPerBeat = g.preset.beatEighths * (g.unit / 8)
  const unitsPerBar = g.preset.num * (g.unit / g.preset.den)
  return { unitSec: 60 / g.bpm / unitsPerBeat, unitsPerBeat, unitsPerBar }
}

/** 마디 안의 한 기호. midi 가 null 이면 쉼표. noteIndex 는 원 노트 배열의 번호(쉼표는 -1). */
export interface ScoreNote {
  dur: string          // VexFlow 길이 문자열 'w' 'h' 'q' '8' '16'
  dots: number
  midi: number | null
  noteIndex: number
  tieToNext: boolean   // 이 조각이 다음 조각과 같은 음(붙임줄)
  q0: number           // 앵커 기준 격자 위치
  q1: number
}

export interface Bar { number: number; q0: number; notes: ScoreNote[] }

export interface Score { bars: Bar[]; grid: Grid; info: GridInfo }

/** 격자 칸 수 → 표준 음길이 분해 (큰 것부터 탐욕). unit=16: 16=온음표. 점음표 포함 */
function pieces(len: number, unit: 8 | 16): { dur: string; dots: number; units: number }[] {
  const table: [number, string, number][] = unit === 16
    ? [[16, 'w', 0], [12, 'h', 1], [8, 'h', 0], [6, 'q', 1], [4, 'q', 0], [3, '8', 1], [2, '8', 0], [1, '16', 0]]
    : [[8, 'w', 0], [6, 'h', 1], [4, 'h', 0], [3, 'q', 1], [2, 'q', 0], [1, '8', 0]]
  const out: { dur: string; dots: number; units: number }[] = []
  let rest = len
  while (rest > 0) {
    const [u, dur, dots] = table.find(([u]) => u <= rest)!
    out.push({ dur, dots, units: u })
    rest -= u
  }
  return out
}

/**
 * 노트를 격자에 스냅해 마디로 나눈다. deleted 노트는 건너뛴다.
 * 스냅: 시작·끝을 각각 가장 가까운 칸으로. 겹치면 앞 음의 끝에 맞추고, 길이 0 이면 1칸.
 */
export function quantize(notes: Note[], grid: Grid): Score {
  const info = gridInfo(grid)
  const { unitSec, unitsPerBar, unitsPerBeat } = info

  // 1. 스냅
  type Q = { q0: number; q1: number; midi: number; noteIndex: number }
  const qs: Q[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (n.deleted) continue
    let q0 = Math.round((n.start - grid.anchor) / unitSec)
    let q1 = Math.round((n.end - grid.anchor) / unitSec)
    const prev = qs[qs.length - 1]
    if (prev && q0 < prev.q1) q0 = prev.q1
    if (q1 <= q0) q1 = q0 + 1
    qs.push({ q0, q1, midi: n.midi, noteIndex: i })
  }
  if (qs.length === 0) return { bars: [], grid, info }

  // 2. 마디 범위. 앵커 앞의 소리는 음수 마디(못갖춘마디)로
  const firstBar = Math.floor(qs[0].q0 / unitsPerBar)
  const lastBar = Math.floor((qs[qs.length - 1].q1 - 1) / unitsPerBar)
  const bars: Bar[] = []
  for (let b = firstBar; b <= lastBar; b++) bars.push({ number: b + 1, q0: b * unitsPerBar, notes: [] })
  const barOf = (q: number) => bars[Math.floor(q / unitsPerBar) - firstBar]

  // 3. 마디 경계에서 자르고, 각 조각을 표준 길이로 분해. 사이는 쉼표(박 경계에서 끊음)
  const emit = (q0: number, q1: number, midi: number | null, noteIndex: number, tieAfter: boolean) => {
    let q = q0
    while (q < q1) {
      const bar = barOf(q)
      const barEnd = bar.q0 + unitsPerBar
      let segEnd = Math.min(q1, barEnd)
      if (midi === null) segEnd = Math.min(segEnd, q + (unitsPerBeat - ((q - bar.q0) % unitsPerBeat)))  // 쉼표는 박 단위로
      const ps = pieces(segEnd - q, grid.unit)
      ps.forEach((p, k) => {
        const end = q + p.units
        const last = k === ps.length - 1
        bar.notes.push({ dur: p.dur, dots: p.dots, midi, noteIndex, q0: q, q1: end, tieToNext: midi !== null && (!last || end < q1 || tieAfter) })
        q = end
      })
    }
  }
  let cursor = firstBar * unitsPerBar
  for (const x of qs) {
    if (x.q0 > cursor) emit(cursor, x.q0, null, -1, false)
    emit(x.q0, x.q1, x.midi, x.noteIndex, false)
    cursor = x.q1
  }
  const end = (lastBar + 1) * unitsPerBar
  if (cursor < end) emit(cursor, end, null, -1, false)

  return { bars, grid, info }
}
