import { useEffect, useRef, useState } from 'react'
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
  onExport: (kind: ExportKind) => void
  saved: 'saving' | 'saved' | 'error' | null
}

export type ExportKind = 'png' | 'print' | 'musicxml' | 'midi'

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
}

export function TopBar({ name, playing, time, duration, selection, onBack, onTogglePlay, onClearSelection, onExport, saved }: Props) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])
  const pick = (k: ExportKind) => { setMenu(false); onExport(k) }
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
      <div className="topbar__group" style={{ justifyContent: 'flex-end', gap: 12 }}>
        <span className="saved">{saved === 'saving' ? '저장 중…' : saved === 'saved' ? '저장됨' : saved === 'error' ? '저장 실패' : ''}</span>
        <div className="menu" ref={menuRef}>
          <button className="btn btn--ghost" onClick={() => setMenu((m) => !m)}>내보내기 ▾</button>
          {menu && (
            <div className="menu__list">
              <button onClick={() => pick('print')}>악보 인쇄 · PDF</button>
              <button onClick={() => pick('png')}>곡선 그림 (PNG)</button>
              <button onClick={() => pick('musicxml')}>MusicXML</button>
              <button onClick={() => pick('midi')}>MIDI</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
