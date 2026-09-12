// 개발용 검증: pyin.ts 결과를 research/pyin_*.json (librosa 기준, hop 256 @ 44.1 kHz)와 비교한다.
import { pyin } from '../src/audio/pyin'

const out = document.getElementById('out')!
const log = (o: unknown) => { out.textContent = typeof o === 'string' ? o : JSON.stringify(o, null, 2) }
const fs = (p: string) => '/@fs' + encodeURI(p.normalize('NFD'))
const ROOT = '/Users/sangholee/채보앱'

async function run(name: string, seg: string) {
  const ab = await (await fetch(fs(`${ROOT}/samples/${name}`))).arrayBuffer()
  const ref: number[] = await (await fetch(fs(`${ROOT}/research/pyin_${name}.json`))).json()
  const buf = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(ab)   // 22.05 kHz로 리샘플
  const y = buf.getChannelData(0)
  const t0 = performance.now()
  const r = pyin(y, { sr: 22050 })
  const ms = performance.now() - t0
  const cents = (a: number, b: number) => 1200 * Math.log2(a / b)
  const midi = (f: number) => 69 + 12 * Math.log2(f / 440)
  let both = 0, agree = 0, agree20 = 0, octave = 0, refOnly = 0, mineOnly = 0, n = 0, jumps = 0, prev = 0, voiced = 0
  for (let i = 0; i < r.f0.length; i++) {
    const j = Math.round(r.times[i] * 44100 / 256)
    const rf = ref[j]; if (rf == null) continue
    n++
    const y0 = r.f0[i]
    if (y0 > 0) { voiced++; if (prev > 0 && Math.abs(midi(y0) - midi(prev)) > 6) jumps++ }
    prev = y0
    if (y0 > 0 && rf > 0) { both++; const d = Math.abs(cents(y0, rf)); if (d < 50) agree++; if (d < 20) agree20++; else if (Math.abs(d - 1200) < 60) octave++ }
    else if (rf > 0) refOnly++; else if (y0 > 0) mineOnly++
  }
  return { seg, frames: n, ms: Math.round(ms), realtimeX: +(buf.duration * 1000 / ms).toFixed(1),
    voicedMine: +(voiced / n).toFixed(3), bothVoiced: +(both / n).toFixed(3), agree50c: +(agree / both).toFixed(3), agree20c: +(agree20 / both).toFixed(3),
    octave: +(octave / both).toFixed(3), refOnly: +(refOnly / n).toFixed(3), mineOnly: +(mineOnly / n).toFixed(3), jumpsPerMin: +(jumps / (buf.duration / 60)).toFixed(1) }
}

try {
  const a = await run('hg_180_240.wav', '180-240s')
  log([a])
  const b = await run('hg_0_90.wav', '0-90s')
  log([a, b])
  ;(window as unknown as { __done: unknown }).__done = [a, b]
} catch (e) { log('ERROR ' + (e as Error).stack) }
