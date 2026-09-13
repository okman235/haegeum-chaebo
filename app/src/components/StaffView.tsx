// 오선보(화면). 렌더는 score/render.ts 가 하고, 여기서는 한 줄로 길게 그려 가로 스크롤 + 선택·재생 위치 강조만 맡는다.
// 렌더는 score 가 바뀔 때만 하고, 강조는 DOM 클래스로만 바꾼다(재렌더 없음).
import { useEffect, useRef } from 'react'
import type { Note } from '../audio/notes'
import type { Score } from '../audio/rhythm'
import { renderScore } from '../score/render'

interface Props {
  score: Score
  notes: Note[]
  selected: number | null
  playhead: number
  playing: boolean
  onSelectNote: (i: number) => void
}

export function StaffView({ score, notes, selected, playhead, playing, onSelectNote }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    renderScore(host.current!, score, { ink: css('--text'), faint: css('--faint'), ids: true })
  }, [score])

  const groupsOf = (i: number) => host.current!.querySelectorAll(`g[id^="vf-n${i}-"]`)
  const reveal = (i: number, ratio: number) => {
    const g = groupsOf(i)[0] as SVGGElement | undefined
    const sc = scroller.current
    if (!g || !sc) return
    const bx = g.getBBox().x
    if (bx < sc.scrollLeft + 40 || bx > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, bx - sc.clientWidth * ratio)
  }

  // 선택 음
  useEffect(() => {
    const el = host.current!
    el.querySelectorAll('g.sel').forEach((g) => g.classList.remove('sel'))
    if (selected === null) return
    groupsOf(selected).forEach((g) => g.classList.add('sel'))
    reveal(selected, 0.3)
  }, [selected, score])

  // 재생 위치 (+따라가기)
  useEffect(() => {
    const el = host.current!
    let i = -1
    let lo = 0, hi = notes.length - 1   // notes 는 시간순
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (notes[mid].start <= playhead) { i = mid; lo = mid + 1 } else hi = mid - 1 }
    if (i >= 0 && (notes[i].deleted || playhead >= notes[i].end + 0.15)) i = -1
    el.querySelectorAll('g.cur').forEach((g) => g.classList.remove('cur'))
    if (i < 0) return
    groupsOf(i).forEach((g) => g.classList.add('cur'))
    if (playing) reveal(i, 0.2)
  }, [playhead, playing, notes, score])

  const onClick = (e: React.MouseEvent) => {
    const g = (e.target as Element).closest('g[id^="vf-n"]')
    if (!g) return
    const i = Number(g.id.slice(4).split('-')[0])
    if (Number.isFinite(i)) onSelectNote(i)
  }

  return (
    <div ref={scroller} className="staff" onClick={onClick}>
      <div ref={host} className="staff__svg" />
      {score.bars.length === 0 && <div className="staff__empty">음을 찾지 못했습니다</div>}
    </div>
  )
}
