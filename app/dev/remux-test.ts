// 앱이 쓰는 movDecode.ts 를 그대로 불러 확인한다 (사파리가 .mov·Opus를 거부하는 경우의 우회로).
import { decodeAudioTrack } from '../src/audio/movDecode'

const out = document.getElementById('out')!
const lines: string[] = []
const say = (s: string) => { lines.push(s); out.textContent = lines.join('\n')
  fetch(`http://${location.hostname}:8899/?row=${encodeURIComponent('[remux] ' + s)}`, { mode: 'no-cors' }).catch(() => {}) }
const fsUrl = (n: string) => '/@fs' + encodeURI(`/Users/sangholee/채보앱/samples/${n}`.normalize('NFD'))

say(`브라우저: ${navigator.userAgent.includes('Version/') ? 'Safari' : 'Chromium'}`)
for (const n of ['probe_iphone.MOV', 'test_synth_screenrec.mov', '지영희류 해금산조 | 중중모리 굿거리 자진모리 [aMVcDNpiVBM].mp4']) {
  try {
    const t0 = performance.now()
    const { channels, sampleRate } = await decodeAudioTrack(await (await fetch(fsUrl(n))).arrayBuffer())
    let peak = 0
    for (const v of channels[0]) { const a = Math.abs(v); if (a > peak) peak = a }
    say(`${n}: ${channels[0].length.toLocaleString()}샘플 = ${(channels[0].length / sampleRate).toFixed(2)}s @ ${sampleRate}Hz ${channels.length}ch · 최대진폭 ${peak.toFixed(3)} · ${Math.round(performance.now() - t0)}ms`)
  } catch (e) { say(`${n}: 실패 — ${(e as Error).message}`) }
}
say('끝')
