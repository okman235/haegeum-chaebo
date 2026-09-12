import { useCallback, useEffect, useRef, useState } from 'react'
import { ANALYSIS_SR, type Project } from './types'
import { decodeFile } from './audio/decode'
import { analyzePitch } from './audio/analyze'
import { Player } from './audio/player'
import { StartScreen } from './components/StartScreen'
import { AnalyzingScreen, type Stage } from './components/AnalyzingScreen'
import { TopBar } from './components/TopBar'
import { CurveView } from './components/CurveView'

type Phase =
  | { kind: 'start' }
  | { kind: 'analyzing'; name: string; stage: Stage; ratio: number; error?: string }
  | { kind: 'ready'; project: Project }

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })

  const openFile = useCallback(async (file: File) => {
    const name = file.name.replace(/\.[^.]+$/, '')
    setPhase({ kind: 'analyzing', name, stage: 'decode', ratio: 0 })
    try {
      const d = await decodeFile(file)
      setPhase({ kind: 'analyzing', name, stage: 'pitch', ratio: 0 })
      const pitch = await analyzePitch(d.mono, ANALYSIS_SR, (ratio) => setPhase({ kind: 'analyzing', name, stage: 'pitch', ratio }))
      setPhase({ kind: 'ready', project: { name, buffer: d.buffer, duration: d.duration, peaks: d.peaks, pitch } })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPhase({ kind: 'analyzing', name, stage: 'decode', ratio: 0,
        error: `이 파일의 소리를 읽지 못했습니다. 브라우저가 지원하는 형식(m4a, mp3, wav, mp4, mov)인지 확인해 주세요. (${message})` })
    }
  }, [])

  if (phase.kind === 'start') return <div className="app"><StartScreen onFile={openFile} /></div>
  if (phase.kind === 'analyzing')
    return <div className="app"><AnalyzingScreen name={phase.name} stage={phase.stage} ratio={phase.ratio} error={phase.error} onBack={() => setPhase({ kind: 'start' })} /></div>
  return <Workspace project={phase.project} onBack={() => setPhase({ kind: 'start' })} />
}

function Workspace({ project, onBack }: { project: Project; onBack: () => void }) {
  const player = useRef<Player | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [selection, setSelection] = useState<[number, number] | null>(null)

  useEffect(() => {
    const p = new Player(project.buffer)
    p.onChange = () => { setPlaying(p.playing); setPlayhead(p.currentTime) }
    player.current = p
    return () => { p.dispose(); player.current = null }
  }, [project])

  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => { const p = player.current; if (p) setPlayhead(p.currentTime); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])

  const togglePlay = () => {
    const p = player.current
    if (!p) return
    if (p.playing) p.pause()
    else if (selection) p.play(selection[0], selection[1])
    else p.play(p.currentTime >= project.duration - 0.05 ? 0 : p.currentTime)
  }
  const seek = (t: number) => { player.current?.seek(t); setPlayhead(t) }

  return (
    <div className="app">
      <TopBar name={project.name} playing={playing} time={playhead} duration={project.duration} selection={selection}
        onBack={onBack} onTogglePlay={togglePlay} onClearSelection={() => setSelection(null)} />
      <div className="workspace">
        <CurveView pitch={project.pitch} peaks={project.peaks} duration={project.duration}
          playhead={playhead} playing={playing} selection={selection} onSeek={seek} onSelect={setSelection} />
      </div>
    </div>
  )
}
