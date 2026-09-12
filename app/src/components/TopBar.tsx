import { BackIcon, CloseIcon, PauseIcon, PlayIcon } from './icons'

interface Props {
  name: string
  playing: boolean
  time: number
  duration: number
  selection: [number, number] | null
  onBack: () => void
  onTogglePlay: () => void
  onClearSelection: () => void
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
}

export function TopBar({ name, playing, time, duration, selection, onBack, onTogglePlay, onClearSelection }: Props) {
  return (
    <div className="topbar">
      <div className="topbar__group">
        <button className="iconbtn" onClick={onBack} aria-label="처음으로"><BackIcon /></button>
        <span className="topbar__title">{name}</span>
        {selection && (
          <span className="chip chip--cyan">
            구간 {fmtTime(selection[0])} ~ {fmtTime(selection[1])}
            <button className="iconbtn" style={{ width: 24, height: 24, marginLeft: 4, marginRight: -6, color: 'inherit' }}
              onClick={onClearSelection} aria-label="구간 해제"><CloseIcon size={14} /></button>
          </span>
        )}
      </div>
      <div className="topbar__group" style={{ gap: 14 }}>
        <button className="playbtn" onClick={onTogglePlay} aria-label={playing ? '일시정지' : '재생'}>
          {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <span className="time">{fmtTime(time)}</span>
        <span className="time time--total">/ {fmtTime(duration)}</span>
      </div>
      <div className="topbar__group" />
    </div>
  )
}
