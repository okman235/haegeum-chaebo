/**
 * 음 분할 + 조율 보정.
 *
 * 입력은 pYIN 프레임(f0, 유성확률)과 파형 봉우리(peaks, 프레임과 같은 hop). 출력은 노트 세그먼트.
 * 리듬 양자화·시김새는 여기서 하지 않는다(v0.3, v0.4). 여기서는 "언제부터 언제까지 어느 음인가"만 정한다.
 *
 * 분할 규칙
 *  1. 무성 구간(f0 = 0)이 gapFrames 이상이면 끊는다.
 *  2. 유성 구간 안에서 음높이가 세그먼트의 중앙값에서 splitSemis 넘게 벗어난 채 holdFrames 이상 지속되면 끊는다.
 *     (농현은 임계 안에서 흔들리므로 한 음으로 남고, 추성·퇴성 끝부분은 다음 음으로 갈라진다 — v0.4 에서 다시 합칠 것)
 *  3. 같은 음을 다시 활로 그은 경우: 에너지가 onsetDb 이상 되살아나면 끊는다.
 *  4. minDur 보다 짧은 조각은 이웃에 붙이거나 버린다.
 */
import type { PitchTrack } from '../types'
import { hzToMidi } from '../music'

export interface Note {
  start: number   // 초
  end: number
  midi: number    // 정수. 보정된 격자 기준
  cents: number   // 중앙값이 격자에서 벗어난 정도 (-50 ~ 50)
  frames: number  // 유성 프레임 수 (신뢰도 표시용)
}

/** 조율: 사용자가 정한 A4 와, 이 녹음이 그 격자에서 통째로 얼마나 벗어났는지(센트). 하드코딩 금지 — 값은 UI 에서 온다. */
export interface Tuning {
  a4: number
  offsetCents: number
}

export interface SegmentOptions {
  splitSemis?: number   // 이만큼 벗어나면 새 음 (기본 0.6 반음)
  holdMs?: number       // 벗어난 상태가 이만큼 지속돼야 인정 (기본 40ms)
  gapMs?: number        // 무성이 이만큼 이어지면 끊음 (기본 30ms)
  minMs?: number        // 이보다 짧은 음은 버리거나 합침 (기본 80ms — 휘모리 8분음표 ≈ 120ms 보다 짧게)
  onsetDb?: number      // 에너지가 골에서 이만큼 되살아나면 재활(再弓) 로 봄 (기본 12dB — 8dB 는 장구 타점에 걸려 같은 음이 쪼개졌다, 2026-09-13 hg_180_240)
}

/**
 * 녹음 전체가 12평균율 격자에서 얼마나 벗어났는지 추정. 유성 프레임의 센트 소수부를 원형 평균한다.
 * 반환값은 (-50, 50] 센트. +12 면 "이 녹음은 격자보다 12센트 높다".
 */
export function estimateOffsetCents(pitch: PitchTrack, a4: number): number {
  let sx = 0, sy = 0
  for (let i = 0; i < pitch.f0.length; i++) {
    const f = pitch.f0[i]
    if (f <= 0) continue
    const w = pitch.voicedProb[i] || 1
    const ang = (hzToMidi(f, a4) % 1) * 2 * Math.PI
    sx += Math.cos(ang) * w; sy += Math.sin(ang) * w
  }
  if (sx === 0 && sy === 0) return 0
  let c = Math.atan2(sy, sx) / (2 * Math.PI) * 100
  if (c > 50) c -= 100
  return c
}

const median = (a: number[]) => {
  if (a.length === 0) return NaN
  const s = [...a].sort((x, y) => x - y)
  const h = s.length >> 1
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
}

export function segmentNotes(pitch: PitchTrack, peaks: Float32Array, tuning: Tuning, opts: SegmentOptions = {}): Note[] {
  const { f0, times, hop, sr } = pitch
  const frameSec = hop / sr
  const splitSemis = opts.splitSemis ?? 0.6
  const holdFrames = Math.max(1, Math.round((opts.holdMs ?? 40) / 1000 / frameSec))
  const gapFrames = Math.max(1, Math.round((opts.gapMs ?? 30) / 1000 / frameSec))
  const minFrames = Math.max(1, Math.round((opts.minMs ?? 80) / 1000 / frameSec))
  const onsetDb = opts.onsetDb ?? 12
  const n = f0.length

  // 보정된 midi (무성은 NaN), 5프레임 중앙값으로 잔떨림 제거
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) raw[i] = f0[i] > 0 ? hzToMidi(f0[i], tuning.a4) - tuning.offsetCents / 100 : NaN
  const midi = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (isNaN(raw[i])) { midi[i] = NaN; continue }
    const win: number[] = []
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) if (!isNaN(raw[k])) win.push(raw[k])
    midi[i] = median(win)
  }

  // 에너지(dB) — peaks 는 분석 모노에서 hop 마다 절대값 최대이므로 프레임과 1:1
  const db = new Float32Array(n)
  for (let i = 0; i < n; i++) { const p = peaks[Math.min(i, peaks.length - 1)] || 1e-5; db[i] = 20 * Math.log10(Math.max(p, 1e-5)) }
  // 재활 onset: 직전 12프레임(≈140ms) 안의 골보다 onsetDb 이상 커진 첫 프레임
  const onset = new Uint8Array(n)
  let lastOnset = -1e9
  for (let i = 1; i < n; i++) {
    let valley = db[i]
    for (let k = Math.max(0, i - 12); k < i; k++) if (db[k] < valley) valley = db[k]
    if (db[i] - valley >= onsetDb && i - lastOnset > minFrames) { onset[i] = 1; lastOnset = i }
  }

  // 분할
  type Seg = { i0: number; i1: number; vals: number[] }   // [i0, i1) 프레임, vals = 유성 midi
  const segs: Seg[] = []
  let cur: Seg | null = null
  let unvoiced = 0, off = 0
  const close = () => { if (cur && cur.vals.length) segs.push(cur); cur = null; unvoiced = 0; off = 0 }
  for (let i = 0; i < n; i++) {
    const m = midi[i]
    if (isNaN(m)) {
      if (cur) { unvoiced++; if (unvoiced >= gapFrames) { cur.i1 = i - unvoiced + 1; close() } }
      continue
    }
    unvoiced = 0
    if (!cur) { cur = { i0: i, i1: i + 1, vals: [m] }; continue }
    const ref = median(cur.vals)
    const deviates = Math.abs(m - ref) > splitSemis
    if (deviates) off++; else off = 0
    if ((off >= holdFrames || onset[i]) && cur.vals.length >= minFrames) {
      // 벗어나기 시작한 프레임부터 새 음
      const cut = onset[i] ? i : i - off + 1
      const take = onset[i] ? 0 : off - 1   // 이미 vals 에 들어간 벗어난 프레임 수
      const moved: number[] = cur.vals.splice(cur.vals.length - take, take)
      cur.i1 = cut
      close()
      cur = { i0: cut, i1: i + 1, vals: [...moved, m] }
      continue
    }
    cur.vals.push(m); cur.i1 = i + 1
  }
  if (cur) { (cur as Seg).i1 = n; close() }

  // 짧은 조각 정리: 이웃(붙어 있고 같은 음)에 합치고, 아니면 버린다
  const notes: Note[] = []
  const toNote = (s: Seg): Note => {
    const med = median(s.vals)
    const r = Math.round(med)
    return { start: times[s.i0], end: times[Math.min(n - 1, s.i1)] ?? times[n - 1] + frameSec, midi: r, cents: (med - r) * 100, frames: s.vals.length }
  }
  for (const s of segs) {
    const note = toNote(s)
    const prev = notes[notes.length - 1]
    if (s.vals.length < minFrames) {
      if (prev && prev.midi === note.midi && note.start - prev.end < frameSec * 2) { prev.end = note.end; prev.frames += note.frames }
      continue
    }
    notes.push(note)
  }
  return notes
}
