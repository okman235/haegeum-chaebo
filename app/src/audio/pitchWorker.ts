// 음높이 추적 워커. 스파이크(spike/pyin.html)에서 검증한 pitchfinder YIN을 프레임 단위로 돌린다.
import { YIN } from 'pitchfinder'

export interface PitchRequest { data: Float32Array; sr: number; frame: number; hop: number }
export type PitchResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; f0: Float32Array; times: Float32Array }

const post = (msg: PitchResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = (e: MessageEvent<PitchRequest>) => {
  const { data, sr, frame, hop } = e.data
  const detect = YIN({ sampleRate: sr, threshold: 0.1 })
  const n = Math.max(0, Math.floor((data.length - frame) / hop) + 1)
  const f0 = new Float32Array(n)
  const times = new Float32Array(n)
  let lastReport = 0
  for (let i = 0; i < n; i++) {
    const p = detect(data.subarray(i * hop, i * hop + frame))   // 무성이면 null
    f0[i] = p && p > 60 && p < 2000 ? p : 0
    times[i] = (i * hop + frame / 2) / sr
    if (i - lastReport >= 250) { post({ type: 'progress', done: i, total: n }); lastReport = i }
  }
  const smoothed = medianFilter(f0, 5)
  post({ type: 'result', f0: smoothed, times }, [smoothed.buffer, times.buffer])
}

/** 유성 프레임만 대상으로 한 중앙값 평활. 한두 프레임짜리 튐(옥타브 오류 등)을 지운다. */
function medianFilter(src: Float32Array, size: number): Float32Array {
  const half = size >> 1
  const out = new Float32Array(src.length)
  const win: number[] = []
  for (let i = 0; i < src.length; i++) {
    if (src[i] === 0) continue
    win.length = 0
    for (let k = -half; k <= half; k++) {
      const v = src[i + k]
      if (v > 0) win.push(v)
    }
    win.sort((a, b) => a - b)
    out[i] = win[win.length >> 1]
  }
  return out
}
