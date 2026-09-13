// 파일로 내려주기 + 곡선 PNG + 악보 인쇄(PDF 는 브라우저 인쇄 대화상자에서 "PDF로 저장").
import type { Score } from '../audio/rhythm'
import { renderScore } from '../score/render'

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000)
}

/** 지금 보이는 곡선 캔버스를 PNG 로. 바탕이 투명하므로 앱 배경색을 깔아 준다 */
export function curvePng(canvas: HTMLCanvasElement): Promise<Blob> {
  const out = document.createElement('canvas')
  out.width = canvas.width; out.height = canvas.height
  const g = out.getContext('2d')!
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f171c'
  g.fillRect(0, 0, out.width, out.height)
  g.drawImage(canvas, 0, 0)
  return new Promise((resolve, reject) => out.toBlob((b) => b ? resolve(b) : reject(new Error('PNG 생성 실패')), 'image/png'))
}

/** 악보를 A4 가로 폭으로 접어 새 창에 그리고 인쇄 대화상자를 연다 */
export function printScore(score: Score, title: string) {
  const holder = document.createElement('div')
  renderScore(holder, score, { ink: '#000', faint: '#666', wrapWidth: 1040, noteW: 34, lineGap: 48 })
  const svg = holder.innerHTML
  const w = window.open('', '_blank')
  if (!w) throw new Error('팝업이 막혔습니다. 이 사이트의 팝업을 허용해 주세요.')
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { margin: 0; font-family: -apple-system, system-ui, sans-serif; color: #000; background: #fff; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 12px; }
  svg { max-width: 100%; height: auto; }
  .hint { position: fixed; right: 12px; top: 12px; font-size: 12px; color: #666; }
  @media print { .hint { display: none } }
</style></head><body>
<div class="hint">⌘P / 공유 → 프린트 → PDF로 저장</div>
<h1>${title}</h1>
<div class="meta">${score.grid.preset.name} ${score.grid.preset.num}/${score.grid.preset.den} · 박 ${score.grid.bpm} · 격자 ${score.grid.unit}분음표 · 해금 채보</div>
${svg}
<script>setTimeout(() => window.print(), 300)</script>
</body></html>`)
  w.document.close()
}
