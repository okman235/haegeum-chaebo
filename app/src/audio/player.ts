/** AudioBuffer 재생기. 시각은 AudioContext 시계로 재서 재생 헤드가 정확하다. */
export class Player {
  private ctx: AudioContext | null = null
  private src: AudioBufferSourceNode | null = null
  private startAt = 0     // 재생 시작 시점의 ctx.currentTime
  private offset = 0      // 재생 시작 시점의 버퍼 위치(초)
  private stopAt: number | null = null
  private position = 0    // 멈춰 있을 때의 위치
  playing = false
  onChange: (() => void) | null = null

  private buffer: AudioBuffer

  constructor(buffer: AudioBuffer) { this.buffer = buffer }

  get currentTime(): number {
    if (!this.playing || !this.ctx) return this.position
    const t = this.offset + (this.ctx.currentTime - this.startAt)
    return Math.min(t, this.stopAt ?? this.buffer.duration)
  }

  /** from에서 재생. to를 주면 거기서 멈추고 헤드는 from으로 돌아간다(구간 재생). */
  play(from: number, to?: number) {
    this.halt()
    const ctx = this.ensureCtx()
    const src = ctx.createBufferSource()
    src.buffer = this.buffer
    src.connect(ctx.destination)
    const dur = to != null ? Math.max(0.01, to - from) : undefined
    src.start(0, from, dur)
    src.onended = () => {
      if (this.src !== src) return
      this.src = null
      this.playing = false
      this.position = to != null ? from : this.buffer.duration
      this.onChange?.()
    }
    this.src = src
    this.startAt = ctx.currentTime
    this.offset = from
    this.stopAt = to ?? null
    this.playing = true
    this.onChange?.()
  }

  pause() {
    if (!this.playing) return
    this.position = this.currentTime
    this.halt()
    this.onChange?.()
  }

  seek(t: number) {
    const wasPlaying = this.playing
    this.halt()
    this.position = t
    if (wasPlaying) this.play(t)
    else this.onChange?.()
  }

  dispose() { this.halt(); void this.ctx?.close(); this.ctx = null }

  private ensureCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private halt() {
    if (this.src) { const s = this.src; this.src = null; s.onended = null; try { s.stop() } catch { /* 이미 멈춤 */ } }
    this.playing = false
    this.stopAt = null
  }
}
