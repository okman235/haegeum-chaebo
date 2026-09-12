import { useRef } from 'react'
import { FolderIcon } from './icons'

interface Props { onFile: (file: File) => void }

export function StartScreen({ onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="start">
      <div className="start__left">
        <div>
          <div className="start__title">해금 채보</div>
          <div className="start__lead">녹음이나 강의 영상을 열면 바로 분석이 시작됩니다. 유튜브 영상은 화면 녹화 파일로 열 수 있습니다.</div>
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
        <div className="start__empty">아직 연 파일이 없습니다.</div>
      </div>
    </div>
  )
}
