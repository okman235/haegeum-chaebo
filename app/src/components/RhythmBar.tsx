// 리듬 격자 띠: 장단 · BPM(탭 템포) · 격자 · 첫 박. 값은 전부 사용자가 정한다 — 자동 박 추적 없음(기획서 6.2).
import { useRef, useState } from 'react'
import { JANGDAN, type Grid } from '../audio/rhythm'
import { fmtTime } from './TopBar'

interface Props {
  grid: Grid
  playhead: number
  onChange: (g: Grid) => void
}

export function RhythmBar({ grid, playhead, onChange }: Props) {
  const taps = useRef<number[]>([])
  const [tapCount, setTapCount] = useState(0)

  // 탭 템포: 최근 8번 탭 간격의 평균. 2초 넘게 쉬면 처음부터
  const tap = () => {
    const now = performance.now()
    const t = taps.current
    if (t.length && now - t[t.length - 1] > 2000) t.length = 0
    t.push(now)
    if (t.length > 8) t.shift()
    setTapCount(t.length)
    if (t.length >= 2) {
      const bpm = 60000 / ((t[t.length - 1] - t[0]) / (t.length - 1))
      onChange({ ...grid, bpm: Math.round(bpm * 10) / 10 })
    }
  }

  return (
    <div className="tuning tuning--rhythm">
      <label className="tuning__item">
        <span className="tuning__label">장단</span>
        <select className="tuning__select" value={grid.preset.id}
          onChange={(e) => onChange({ ...grid, preset: JANGDAN.find((j) => j.id === e.target.value)! })}>
          {JANGDAN.map((j) => <option key={j.id} value={j.id}>{j.name} {j.num}/{j.den}</option>)}
        </select>
      </label>
      <label className="tuning__item">
        <span className="tuning__label">박 = {grid.preset.beatEighths === 3 ? '♩.' : '♩'}</span>
        <input className="tuning__num" type="number" min={20} max={300} step={0.5} value={grid.bpm}
          onChange={(e) => { const v = Number(e.target.value); if (v >= 10 && v <= 400) onChange({ ...grid, bpm: v }) }} />
        <button className="btn btn--small" onClick={tap} title="박에 맞춰 여러 번 누르면 BPM 이 잡힙니다">
          탭{tapCount >= 2 ? ` ${tapCount}` : ''}
        </button>
      </label>
      <label className="tuning__item">
        <span className="tuning__label">격자</span>
        <select className="tuning__select" value={grid.unit} onChange={(e) => onChange({ ...grid, unit: Number(e.target.value) as 8 | 16 })}>
          <option value={8}>8분음표</option>
          <option value={16}>16분음표</option>
        </select>
      </label>
      <span className="tuning__item">
        <span className="tuning__label">첫 박</span>
        <span className="tuning__val">{fmtTime(grid.anchor)}</span>
        <button className="btn btn--small" onClick={() => onChange({ ...grid, anchor: playhead })} title="재생 헤드 자리를 첫 마디 첫 박으로">
          = 현재 위치
        </button>
      </span>
    </div>
  )
}
