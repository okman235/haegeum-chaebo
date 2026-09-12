import { PEAK_STEP } from '../types'

export interface Decoded {
  buffer: AudioBuffer
  mono: Float32Array
  sr: number
  duration: number
  peaks: Float32Array
}

/** 오디오/영상 파일을 브라우저 디코더로 풀어 모노 샘플과 파형 봉우리를 만든다. 영상은 소리 트랙만 쓴다. */
export async function decodeFile(file: File): Promise<Decoded> {
  const bytes = await file.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await ctx.decodeAudioData(bytes)
  const mono = toMono(buffer)
  return { buffer, mono, sr: buffer.sampleRate, duration: buffer.duration, peaks: computePeaks(mono) }
}

function toMono(buffer: AudioBuffer): Float32Array {
  const n = buffer.numberOfChannels
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / n
  }
  return out
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
