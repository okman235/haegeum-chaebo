// 스파이크 ③: 아이패드 등 실기기에서 파이프라인 처리 시간을 재고 화면에 띄운다.
// 아이패드 사파리는 콘솔을 볼 수 없으므로 결과를 반드시 화면에 그린다.
import { analyzePitch } from '../src/audio/analyze'
import { decodeFile } from '../src/audio/decode'
import { ANALYSIS_SR } from '../src/types'

const ROOT = '/Users/sangholee/채보앱'
const fsUrl = (name: string) => '/@fs' + encodeURI(`${ROOT}/samples/${name}`.normalize('NFD'))

const SAMPLES = [
  { name: 'hg_180_240.wav', label: '해금 60초 (wav)' },
  { name: 'hg_0_90.wav', label: '해금 90초 (wav)' },
  { name: '지영희류 해금산조 | 중중모리 굿거리 자진모리 [aMVcDNpiVBM].mp4', label: '산조 영상 전체 (mp4 72MB)' },
]

const $ = (id: string) => document.getElementById(id)!
const status = (s: string) => { $('status').textContent = s }
const rows: string[][] = []

function addRow(cells: string[]) {
  rows.push(cells)
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
    return { file: new File([bytes], s.name), fetchMs: performance.now() - t }
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

$('env').textContent = `${navigator.userAgent} · 코어 ${navigator.hardwareConcurrency}`
status('버튼을 눌러 시작')
