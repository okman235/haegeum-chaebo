// 스파이크 ③: 아이패드 등 실기기에서 파이프라인 처리 시간을 재고 화면에 띄운다.
// 아이패드 사파리는 콘솔을 볼 수 없으므로 결과를 반드시 화면에 그린다.
import { analyzePitch } from '../src/audio/analyze'
import { decodeFile } from '../src/audio/decode'
import { ANALYSIS_SR } from '../src/types'

const ROOT = '/Users/sangholee/채보앱'
const fsUrl = (name: string) => '/@fs' + encodeURI(`${ROOT}/samples/${name}`.normalize('NFD'))

const SAMPLES: { name: string; label: string; patch?: boolean }[] = [
  { name: 'hg_180_240.wav', label: '해금 60초 · wav' },
  { name: 'hg_0_90.wav', label: '해금 90초 · wav' },
  // 영상 디코드 진단 (2026-09-13 아이패드에서 원본 mp4가 EncodingError)
  { name: 'test_synth_screenrec.mov', label: '작은 영상 4초 · mov H.264+AAC' },
  { name: '지영희류 해금산조 | 중중모리 굿거리 자진모리 [aMVcDNpiVBM].mp4', label: '산조 6분 · mp4 VP9+Opus 72MB (유튜브 원본)' },
  { name: 'probe_sanjo_aac.m4a', label: '산조 6분 · m4a AAC 소리만 6MB' },
  { name: 'probe_sanjo_h264_aac.mp4', label: '산조 6분 · mp4 H.264+AAC 79MB' },
  // 컨테이너 가르기 (2026-09-13 아이패드: mp4 H.264+AAC 성공, 같은 코덱의 .mov 실패)
  { name: 'probe_synth_remux.mp4', label: '합성 4초 · mov를 mp4로 리먹스 (코덱 그대로)' },
  { name: 'probe_synth_audio.m4a', label: '합성 4초 · mov에서 소리만 뽑은 m4a' },
  { name: 'probe_sanjo_remux.mov', label: '산조 6분 · 되던 mp4를 mov로 리먹스 79MB' },
  // ftyp 브랜드만 'qt  ' → 'isom' 으로 바꿔치기해도 웹킷이 받아들이는지 (고치는 값이 이 4바이트면 가장 싸다)
  { name: 'test_synth_screenrec.mov', label: '합성 4초 · mov의 ftyp만 isom으로', patch: true },
  { name: 'probe_sanjo_remux.mov', label: '산조 6분 · mov의 ftyp만 isom으로', patch: true },
]

/** QuickTime 컨테이너(ftyp major brand 'qt  ')를 'isom'으로만 바꾼다. 나머지 바이트는 그대로. */
function patchQtBrand(buf: ArrayBuffer): ArrayBuffer {
  const u8 = new Uint8Array(buf)
  const tag = (o: number) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3])
  if (tag(4) === 'ftyp' && tag(8) === 'qt  ') u8.set([0x69, 0x73, 0x6f, 0x6d], 8)
  return u8.buffer
}

const $ = (id: string) => document.getElementById(id)!
const status = (s: string) => { $('status').textContent = s }
const rows: string[][] = []

// 결과를 수집기(같은 호스트 8899)로 흘려보낸다. 아이패드에서 손으로 옮겨 적지 않으려고.
function report(cells: string[]) {
  const row = [navigator.userAgent.includes('Version/') ? 'Safari' : 'Chromium', ...cells].join(' | ')
  fetch(`http://${location.hostname}:8899/?row=${encodeURIComponent(row)}`, { mode: 'no-cors' }).catch(() => {})
}

function addRow(cells: string[]) {
  rows.push(cells)
  report(cells)
  const tr = document.createElement('tr')
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join('')
  $('tbl').querySelector('tbody')!.appendChild(tr)
}

const sec = (ms: number) => (ms / 1000).toFixed(2) + 's'

async function bench(label: string, getFile: () => Promise<{ file: File; fetchMs: number }>) {
  const buttons = [...document.querySelectorAll('button')] as HTMLButtonElement[]
  buttons.forEach((b) => (b.disabled = true))
  try {
    status(`${label}: 파일 읽는 중…`)
    const { file, fetchMs } = await getFile()

    status(`${label}: 디코드 + 리샘플…`)
    const t0 = performance.now()
    const d = await decodeFile(file)
    const decodeMs = performance.now() - t0

    status(`${label}: 음높이 추적 0%`)
    const t1 = performance.now()
    await analyzePitch(d.mono, ANALYSIS_SR, (r) => status(`${label}: 음높이 추적 ${Math.round(r * 100)}%`))
    const pitchMs = performance.now() - t1

    const total = decodeMs + pitchMs
    addRow([label, d.duration.toFixed(1) + 's', sec(fetchMs), sec(decodeMs), sec(pitchMs), sec(total),
      (d.duration * 1000 / total).toFixed(1) + '배'])
    status(`${label}: 끝 — ${sec(total)} (실시간 ${(d.duration * 1000 / total).toFixed(1)}배)`)
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    addRow([label, '—', '—', '—', '—', '실패', msg])
    status(`${label}: 실패 — ${msg}`)
  } finally {
    buttons.forEach((b) => (b.disabled = false))
  }
}

for (const s of SAMPLES) {
  const b = document.createElement('button')
  b.textContent = s.label
  b.onclick = () => bench(s.label, async () => {
    const t = performance.now()
    const res = await fetch(fsUrl(s.name))
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    const bytes = await res.arrayBuffer()
    return { file: new File([s.patch ? patchQtBrand(bytes) : bytes], s.name), fetchMs: performance.now() - t }
  })
  $('buttons').appendChild(b)
}

;($('pick') as HTMLInputElement).onchange = (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) bench(f.name, async () => ({ file: f, fetchMs: 0 }))
}

$('copy').onclick = () => {
  const text = [`기기: ${navigator.userAgent}`, `코어: ${navigator.hardwareConcurrency}`,
    ...rows.map((r) => r.join(' | '))].join('\n')
  navigator.clipboard?.writeText(text).then(() => status('결과를 클립보드에 복사했습니다'),
    () => status('복사 실패 — 화면을 캡처해 주세요'))
}

const want = new URLSearchParams(location.search).get('run')
if (want) {
  const picked = want === 'all' ? SAMPLES.map((_, i) => i) : want.split(',').map(Number)
  void (async () => {
    for (const i of picked) {
      const s = SAMPLES[i]
      if (!s) continue
      await bench(s.label, async () => {
        const t = performance.now()
        const res = await fetch(fsUrl(s.name))
        if (!res.ok) throw new Error(`fetch ${res.status}`)
        const bytes = await res.arrayBuffer()
        return { file: new File([s.patch ? patchQtBrand(bytes) : bytes], s.name), fetchMs: performance.now() - t }
      })
    }
    status('자동 실행 끝')
  })()
}

$('env').textContent = `${navigator.userAgent} · 코어 ${navigator.hardwareConcurrency}`
status('버튼을 눌러 시작')
