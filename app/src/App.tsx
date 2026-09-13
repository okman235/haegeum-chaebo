import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ANALYSIS_SR, type Project } from './types'
import { decodeFile } from './audio/decode'
import { analyzePitch } from './audio/analyze'
import { applyEdits, editKey, estimateOffsetCents, segmentNotes, type Note, type NoteEdit, type SegmentOptions } from './audio/notes'
import { JANGDAN, gridInfo, quantize, type Grid } from './audio/rhythm'
import { Player } from './audio/player'
import { StartScreen } from './components/StartScreen'
import { AnalyzingScreen, type Stage } from './components/AnalyzingScreen'
import { TopBar } from './components/TopBar'
import { CurveView } from './components/CurveView'
import { StaffView } from './components/StaffView'
import { TuningBar, type TuningState } from './components/TuningBar'
import { RhythmBar } from './components/RhythmBar'

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
      const t0 = performance.now()
      const d = await decodeFile(file)
      const t1 = performance.now()
      setPhase({ kind: 'analyzing', name, stage: 'pitch', ratio: 0 })
      const pitch = await analyzePitch(d.mono, ANALYSIS_SR, (ratio) => setPhase({ kind: 'analyzing', name, stage: 'pitch', ratio }))
      const t2 = performance.now()
      console.info(`[timing] 디코드+리샘플 ${Math.round(t1 - t0)}ms · 음높이 추적 ${Math.round(t2 - t1)}ms · 길이 ${d.duration.toFixed(1)}s`)
      setPhase({ kind: 'ready', project: { name, buffer: d.buffer, duration: d.duration, peaks: d.peaks, pitch } })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPhase({ kind: 'analyzing', name, stage: 'decode', ratio: 0,
        error: `이 파일의 소리를 읽지 못했습니다. 브라우저가 지원하는 형식(m4a, mp3, wav, mp4, mov)인지 확인해 주세요. (${message})` })
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const name = new URLSearchParams(location.search).get('open')
    if (!name) return
    const url = '/@fs' + encodeURI(`${__REPO_ROOT__}/samples/${name}`.normalize('NFD'))
    fetch(url).then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); openFile(new File([await r.blob()], name)) })
      .catch((e) => console.error('[dev] ?open 실패', e))
  }, [openFile])

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
  const [tuningState, setTuningState] = useState<TuningState>({ a4: 440, useOffset: true, splitSemis: 0.6 })
  const [sel, setSel] = useState<{ i: number; of: Note[] } | null>(null)

  // 조율 편차는 A4 가 바뀔 때만, 분할은 설정이 바뀔 때만 다시 (둘 다 수십 ms)
  const estimatedOffset = useMemo(() => estimateOffsetCents(project.pitch, tuningState.a4), [project, tuningState.a4])
  const tuning = useMemo(() => ({ a4: tuningState.a4, offsetCents: tuningState.useOffset ? estimatedOffset : 0 }), [tuningState, estimatedOffset])
  const rawNotes = useMemo(() => segmentNotes(project.pitch, project.peaks, tuning, { splitSemis: tuningState.splitSemis }), [project, tuning, tuningState.splitSemis])

  // 리듬 격자 + 편집. 편집은 원 노트의 시작 시각이 열쇠라 다시 분할돼도 같은 자리면 살아남는다
  const [grid, setGrid] = useState<Grid>({ preset: JANGDAN[2], unit: 8, bpm: 60, anchor: 0 })
  const [edits, setEdits] = useState<Map<number, NoteEdit>>(() => new Map())
  const info = useMemo(() => gridInfo(grid), [grid])
  const notes = useMemo(() => applyEdits(rawNotes, edits, info.unitSec), [rawNotes, edits, info.unitSec])
  const score = useMemo(() => quantize(notes, grid), [notes, grid])
  // 선택은 그때의 분할 결과(rawNotes)에 묶인다 — 다시 분할되면 자동으로 풀리고, 편집만으로는 안 풀린다
  const selectedNote = sel && sel.of === rawNotes ? sel.i : null
  if (import.meta.env.DEV) {   // 개발 콘솔에서 분할 결과·옵션 실험을 하려고
    const w = window as unknown as { __notes: Note[]; __segment: (o: SegmentOptions) => Note[] }
    w.__notes = notes
    w.__segment = (o) => segmentNotes(project.pitch, project.peaks, tuning, o)
    ;(window as unknown as { __score: unknown }).__score = score
  }

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
  // 음을 고르면 그 구간이 선택되고 재생 헤드가 앞으로 간다 → 재생 버튼이 그 음만 들려준다
  const selectNote = (i: number) => {
    const n = notes[i]
    if (!n) return
    setSel({ i, of: rawNotes }); setSelection([n.start, n.end]); seek(n.start)
  }
  const clearSelection = () => { setSelection(null); setSel(null) }
  const select = (r: [number, number] | null) => { setSelection(r); setSel(null) }
  const editSelected = (e: NoteEdit) => {
    if (selectedNote === null) return
    const k = editKey(rawNotes[selectedNote])
    setEdits((m) => {
      const next = new Map(m)
      const cur = next.get(k) ?? {}
      next.set(k, {
        transpose: (cur.transpose ?? 0) + (e.transpose ?? 0),
        dStart: (cur.dStart ?? 0) + (e.dStart ?? 0),
        dEnd: (cur.dEnd ?? 0) + (e.dEnd ?? 0),
        deleted: cur.deleted || e.deleted,
      })
      return next
    })
    if (e.deleted) { setSel(null); setSelection(null) }
  }

  return (
    <div className="app">
      <TopBar name={project.name} playing={playing} time={playhead} duration={project.duration} selection={selection}
        onBack={onBack} onTogglePlay={togglePlay} onClearSelection={clearSelection} />
      <div className="workspace">
        <CurveView pitch={project.pitch} peaks={project.peaks} duration={project.duration}
          notes={notes} tuning={tuning} selectedNote={selectedNote} grid={grid} gridInfo={info}
          playhead={playhead} playing={playing} selection={selection} onSeek={seek} onSelect={select} onSelectNote={selectNote} />
        <TuningBar state={tuningState} estimatedOffset={estimatedOffset} notes={notes}
          selected={selectedNote !== null ? notes[selectedNote] ?? null : null} onChange={setTuningState} onEdit={editSelected} />
        <RhythmBar grid={grid} playhead={playhead} onChange={setGrid} />
        <StaffView score={score} notes={notes} selected={selectedNote} playhead={playhead} playing={playing} onSelectNote={selectNote} />
      </div>
    </div>
  )
}
