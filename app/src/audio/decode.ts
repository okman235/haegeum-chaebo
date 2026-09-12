import { ANALYSIS_SR, PEAK_STEP } from '../types'

export interface Decoded {
  buffer: AudioBuffer      // 재생용, 원래 샘플레이트
  mono: Float32Array       // 분석용, ANALYSIS_SR 모노
  duration: number
  peaks: Float32Array
}

/** 오디오/영상 파일을 브라우저 디코더로 풀고, 분석용으로 22.05 kHz 모노를 따로 만든다. 영상은 소리 트랙만 쓴다. */
export async function decodeFile(file: File): Promise<Decoded> {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  let buffer: AudioBuffer
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer())
  } catch {
    // 사파리는 .mov와 Opus를 여기서 거부한다. 소리 트랙을 직접 뜯어 온다 (movDecode.ts).
    const { decodeAudioTrack } = await import('./movDecode')
    const { channels, sampleRate } = await decodeAudioTrack(await file.arrayBuffer())
    buffer = new AudioBuffer({ length: channels[0].length, sampleRate, numberOfChannels: channels.length })
    channels.forEach((ch, i) => buffer.copyToChannel(ch, i))
  }
  const mono = await resampleMono(buffer, ANALYSIS_SR)
  return { buffer, mono, duration: buffer.duration, peaks: computePeaks(mono) }
}

/** OfflineAudioContext로 리샘플 + 모노 다운믹스 (브라우저 내장 리샘플러 사용) */
async function resampleMono(buffer: AudioBuffer, targetSr: number): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * targetSr)
  const ctx = new OfflineAudioContext(1, length, targetSr)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start(0)
  const out = await ctx.startRendering()
  return out.getChannelData(0)
}

function computePeaks(mono: Float32Array): Float32Array {
  const n = Math.ceil(mono.length / PEAK_STEP)
  const peaks = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let m = 0
    const end = Math.min(mono.length, (i + 1) * PEAK_STEP)
    for (let j = i * PEAK_STEP; j < end; j++) { const a = Math.abs(mono[j]); if (a > m) m = a }
    peaks[i] = m
  }
  return peaks
}
