// 음높이 추적 워커. pyin.ts(librosa pyin 이식)를 돌리고 진행률을 알린다.
import { pyin } from './pyin'

export interface PitchRequest { data: Float32Array; sr: number }
export type PitchResponse =
  | { type: 'progress'; ratio: number }
  | { type: 'result'; f0: Float32Array; times: Float32Array; voicedProb: Float32Array; sr: number; hop: number; frame: number }

const post = (msg: PitchResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = (e: MessageEvent<PitchRequest>) => {
  const { data, sr } = e.data
  let last = 0
  const r = pyin(data, {
    sr,
    onProgress: (ratio) => { if (ratio - last >= 0.01) { last = ratio; post({ type: 'progress', ratio }) } },
  })
  post({ type: 'result', f0: r.f0, times: r.times, voicedProb: r.voicedProb, sr: r.sr, hop: r.hop, frame: r.frame },
    [r.f0.buffer, r.times.buffer, r.voicedProb.buffer])
}
