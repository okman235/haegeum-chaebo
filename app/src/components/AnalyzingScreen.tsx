import { CheckIcon } from './icons'

export type Stage = 'decode' | 'pitch'
interface Props { name: string; stage: Stage; ratio: number; error?: string; onBack?: () => void }

const STAGES: { key: Stage; label: string }[] = [
  { key: 'decode', label: '디코딩' },
  { key: 'pitch', label: '음높이 추적' },
]

export function AnalyzingScreen({ name, stage, ratio, error, onBack }: Props) {
  const idx = STAGES.findIndex((s) => s.key === stage)
  const pct = Math.round(ratio * 100)
  return (
    <div className="analyzing">
      <div>
        <div className="analyzing__name">{name}</div>
        {error && <div className="analyzing__meta">열 수 없는 파일</div>}
      </div>
      {error ? (
        <>
          <div className="error">{error}</div>
          <button className="btn btn--secondary" onClick={onBack}>다른 파일 열기</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="progress"><div className="progress__bar" style={{ width: `${stage === 'pitch' ? pct : 0}%` }} /></div>
            <div className="analyzing__stage">
              <span style={{ fontWeight: 500 }}>{STAGES[idx].label} 중</span>
              {stage === 'pitch' && <span className="analyzing__pct">{pct}%</span>}
            </div>
          </div>
          <div className="stages">
            {STAGES.map((s, i) => (
              <div key={s.key} className={`stage ${i < idx ? 'stage--done' : i === idx ? 'stage--active' : ''}`}>
                <div className="stage__dot">{i < idx && <CheckIcon size={14} />}</div>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
