// 조율·분할 설정 띠. 값은 여기서 사용자가 정한다 — 코드에 해금 조율을 박아 두지 않는다.
import { noteName } from '../music'
import type { Note, NoteEdit } from '../audio/notes'

export interface TuningState {
  a4: number
  useOffset: boolean
  splitSemis: number
}

interface Props {
  state: TuningState
  estimatedOffset: number   // 이 녹음의 격자 편차(센트), 히스토그램 추정
  notes: Note[]
  selected: Note | null
  onChange: (s: TuningState) => void
  onEdit: (e: NoteEdit) => void   // 선택 음에 편집을 더한다 (transpose 는 누적, dStart/dEnd 는 격자 칸 누적)
}

const fmtCents = (c: number) => `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(0)}c`

export function TuningBar({ state, estimatedOffset, notes, selected, onChange, onEdit }: Props) {
  return (
    <div className="tuning">
      <label className="tuning__item">
        <span className="tuning__label">기준 A4</span>
        <input className="tuning__num" type="number" min={400} max={480} step={0.5} value={state.a4}
          onChange={(e) => { const v = Number(e.target.value); if (v >= 380 && v <= 500) onChange({ ...state, a4: v }) }} />
        <span className="tuning__unit">Hz</span>
      </label>
      <label className="tuning__item">
        <input type="checkbox" checked={state.useOffset} onChange={(e) => onChange({ ...state, useOffset: e.target.checked })} />
        <span className="tuning__label">이 녹음 편차 <b className="tuning__val">{fmtCents(estimatedOffset)}</b> 보정</span>
      </label>
      <label className="tuning__item">
        <span className="tuning__label">분할 감도</span>
        <input type="range" min={0.3} max={1.2} step={0.05} value={state.splitSemis}
          onChange={(e) => onChange({ ...state, splitSemis: Number(e.target.value) })} />
        <span className="tuning__val">{state.splitSemis.toFixed(2)}반음</span>
      </label>
      <span className="tuning__spacer" />
      {selected ? (
        <span className="tuning__item">
          <span className="tuning__info">{noteName(selected.midi)} <span className="tuning__val">{fmtCents(selected.cents)}</span> · {(selected.end - selected.start).toFixed(2)}s</span>
          <span className="editbtns">
            <button className="btn btn--small" onClick={() => onEdit({ transpose: 1 })} title="반음 올림">♯</button>
            <button className="btn btn--small" onClick={() => onEdit({ transpose: -1 })} title="반음 내림">♭</button>
            <button className="btn btn--small" onClick={() => onEdit({ dStart: -1 })} title="시작을 한 칸 앞으로">시작◀</button>
            <button className="btn btn--small" onClick={() => onEdit({ dStart: 1 })} title="시작을 한 칸 뒤로">▶</button>
            <button className="btn btn--small" onClick={() => onEdit({ dEnd: -1 })} title="끝을 한 칸 앞으로">끝◀</button>
            <button className="btn btn--small" onClick={() => onEdit({ dEnd: 1 })} title="끝을 한 칸 뒤로">▶</button>
            <button className="btn btn--small btn--danger" onClick={() => onEdit({ deleted: true })} title="이 음을 지움">지움</button>
          </span>
        </span>
      ) : <span className="tuning__info">음 {notes.filter((n) => !n.deleted).length}개</span>}
    </div>
  )
}
