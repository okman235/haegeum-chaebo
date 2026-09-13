/**
 * IndexedDB 저장. 서버 없음 — 프로젝트는 이 기기 안에만 있다.
 *
 * 저장소 둘: 'meta'(목록용, 가벼움) 와 'projects'(음높이 트랙 + 원본 오디오 Blob).
 * 다시 열 때는 오디오만 다시 디코드하고(0.3초) pYIN 은 저장된 것을 쓴다(아이패드에서 1분 넘게 걸리는 부분).
 */
import type { PitchTrack } from './types'
import type { NoteEdit } from './audio/notes'
import type { TuningState } from './components/TuningBar'

export interface ProjectMeta {
  id: string
  name: string
  duration: number
  savedAt: number       // epoch ms
  audioType: string
}

export interface ProjectSettings {
  tuning: TuningState
  grid: { presetId: string; unit: 8 | 16; bpm: number; anchor: number }
  edits: [number, NoteEdit][]
}

export interface StoredProject extends ProjectMeta {
  pitch: PitchTrack
  peaks: Float32Array
  audio: Blob
  settings: ProjectSettings | null
}

const DB = 'chaebo', VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error)
  tx.onabort = () => reject(tx.error)
})
const result = <T,>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await open()
  const all = await result(db.transaction('meta').objectStore('meta').getAll() as IDBRequest<ProjectMeta[]>)
  db.close()
  return all.sort((a, b) => b.savedAt - a.savedAt)
}

export async function saveProject(p: StoredProject): Promise<void> {
  const db = await open()
  const tx = db.transaction(['meta', 'projects'], 'readwrite')
  const meta: ProjectMeta = { id: p.id, name: p.name, duration: p.duration, savedAt: p.savedAt, audioType: p.audioType }
  tx.objectStore('meta').put(meta)
  tx.objectStore('projects').put(p)
  await done(tx)
  db.close()
}

/** 설정만 갱신 (오디오·음높이는 그대로). 레코드를 읽어 settings 만 바꿔 다시 넣는다 */
export async function saveSettings(id: string, settings: ProjectSettings): Promise<void> {
  const db = await open()
  const tx = db.transaction(['meta', 'projects'], 'readwrite')
  const store = tx.objectStore('projects')
  const cur = await result(store.get(id) as IDBRequest<StoredProject | undefined>)
  if (!cur) { db.close(); return }
  const savedAt = Date.now()
  store.put({ ...cur, settings, savedAt })
  tx.objectStore('meta').put({ id: cur.id, name: cur.name, duration: cur.duration, savedAt, audioType: cur.audioType } satisfies ProjectMeta)
  await done(tx)
  db.close()
}

export async function loadProject(id: string): Promise<StoredProject | undefined> {
  const db = await open()
  const p = await result(db.transaction('projects').objectStore('projects').get(id) as IDBRequest<StoredProject | undefined>)
  db.close()
  return p
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open()
  const tx = db.transaction(['meta', 'projects'], 'readwrite')
  tx.objectStore('meta').delete(id)
  tx.objectStore('projects').delete(id)
  await done(tx)
  db.close()
}
