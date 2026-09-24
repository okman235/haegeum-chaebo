import { useEffect, useRef, useState } from 'react'
import { FolderIcon } from './icons'
import { deleteProject, listProjects, type ProjectMeta } from '../storage'
import { fmtTime } from './TopBar'

interface Props { onFile: (file: File) => void; onOpenSaved: (id: string) => void }

const fmtDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const ACCEPT_EXT = /\.(m4a|mp3|wav|aac|mov|mp4|webm|ogg|flac|aiff?|caf)$/i
const isMedia = (f: File) => f.type.startsWith('audio/') || f.type.startsWith('video/') || ACCEPT_EXT.test(f.name)

export function StartScreen({ onFile, onOpenSaved }: Props) {
  const input = useRef<HTMLInputElement>(null)
  // 드래그앤드롭: 화면 어디에 놓아도 열린다. 자식 요소를 지날 때 leave 가 튀므로 깊이를 센다.
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (depth.current++ === 0) setDragging(true) }
  const onDragLeave = () => { if (--depth.current <= 0) { depth.current = 0; setDragging(false) } }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); depth.current = 0; setDragging(false)
    const f = [...e.dataTransfer.files].find(isMedia)
    if (f) onFile(f)
  }
  const [recent, setRecent] = useState<ProjectMeta[] | null>(null)
  useEffect(() => { listProjects().then(setRecent, () => setRecent([])) }, [])
  const remove = async (id: string) => { await deleteProject(id); setRecent((r) => r?.filter((p) => p.id !== id) ?? null) }
  return (
    <div className={`start${dragging ? ' start--drag' : ''}`} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {dragging && <div className="start__drop">여기에 놓으면 바로 분석합니다</div>}
      <div className="start__left">
        <div>
          <div className="start__title">해금 채보</div>
          <div className="start__lead">녹음이나 강의 영상을 열거나 이 화면에 끌어다 놓으면 바로 분석이 시작됩니다. 유튜브 영상은 화면 녹화 파일로 열 수 있습니다.</div>
        </div>
        <button className="btn btn--primary btn--big" onClick={() => input.current?.click()}>
          <FolderIcon size={18} /> 녹음·영상 파일 열기
        </button>
        <input ref={input} type="file" hidden accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.mov,.mp4,.webm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        <div style={{ flex: 1 }} />
        <div className="start__foot">녹음은 이 기기 안에서만 처리되고 어디로도 전송되지 않습니다.</div>
      </div>
      <div className="start__right">
        <div className="start__section">최근 프로젝트</div>
        {recent === null ? null : recent.length === 0
          ? <div className="start__empty">아직 연 파일이 없습니다.</div>
          : recent.map((p) => (
            <div key={p.id} className="recent">
              <button className="recent__main" onClick={() => onOpenSaved(p.id)}>
                <span className="recent__name">{p.name}</span>
                <span className="recent__meta">{fmtTime(p.duration)} · {fmtDate(p.savedAt)}</span>
              </button>
              <button className="iconbtn recent__del" onClick={() => remove(p.id)} aria-label="지우기">×</button>
            </div>
          ))}
      </div>
    </div>
  )
}
