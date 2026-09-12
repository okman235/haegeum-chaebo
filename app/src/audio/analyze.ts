import type { PitchTrack } from '../types'
import type { PitchRequest, PitchResponse } from './pitchWorker'

export function analyzePitch(mono: Float32Array, sr: number, onProgress: (ratio: number) => void): Promise<PitchTrack> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now()
    let firstMsg = 0
    const worker = new Worker(new URL('./pitchWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PitchResponse>) => {
      const msg = e.data
      if (!firstMsg) firstMsg = performance.now() - t0
      if (msg.type === 'progress') { onProgress(msg.ratio); return }
      worker.terminate()
      console.info(`[timing] 워커 첫 응답 ${Math.round(firstMsg)}ms · 워커 내부 계산 ${Math.round(msg.computeMs)}ms · 전체 ${Math.round(performance.now() - t0)}ms · 입력 ${mono.length} 샘플`)
      resolve({ f0: msg.f0, times: msg.times, voicedProb: msg.voicedProb, sr: msg.sr, hop: msg.hop, frame: msg.frame })
    }
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || '음높이 추적 실패')) }
    const req: PitchRequest = { data: mono, sr }
    worker.postMessage(req, [mono.buffer])   // 샘플은 워커로 넘김 (복사 없음)
  })
}
