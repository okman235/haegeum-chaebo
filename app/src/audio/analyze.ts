import type { PitchTrack } from '../types'
import type { PitchRequest, PitchResponse } from './pitchWorker'

export const FRAME = 2048
export const HOP = 256

export function analyzePitch(mono: Float32Array, sr: number, onProgress: (ratio: number) => void): Promise<PitchTrack> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pitchWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PitchResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') { onProgress(msg.done / msg.total); return }
      worker.terminate()
      resolve({ f0: msg.f0, times: msg.times, frame: FRAME, hop: HOP })
    }
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || '음높이 추적 실패')) }
    const req: PitchRequest = { data: mono, sr, frame: FRAME, hop: HOP }
    worker.postMessage(req, [mono.buffer])   // 샘플은 워커로 넘김 (복사 없음)
  })
}
