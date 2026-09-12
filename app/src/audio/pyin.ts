/**
 * pYIN 음높이 추적 - librosa.pyin(0.10.2) 알고리즘의 JS 이식.
 *
 * 1) 프레임마다 YIN의 누적평균정규화차이(CMND)를 구하고 골(trough)을 후보로 삼는다.
 * 2) 후보마다 확률: 임계값 100개에 베타(2,18) 분포를 얹고, 각 임계값 아래 골들에 볼츠만(λ=2) 우선순위를 준다.
 * 3) 유성 음높이 칸(10칸/반음) + 무성 칸의 2층 HMM을 비터비로 풀어 옥타브 튐을 없앤다.
 *
 * librosa와 다른 점: 비터비를 후보 칸에만 돌려 빠르고, 결과 주파수는 칸 중심이 아니라
 * 포물선 보간한 후보값이라 더 정밀하다. 긴 파일은 청크 단위로 역추적해 메모리를 묶어 둔다.
 */

export interface PyinOptions {
  sr: number
  fmin?: number
  fmax?: number
  frameLength?: number
  winLength?: number
  hopLength?: number
  onProgress?: (ratio: number) => void
}

export interface PyinResult {
  f0: Float32Array          // Hz, 0 = 무성
  voicedProb: Float32Array
  times: Float32Array       // 초 (center=True: i * hop / sr)
  sr: number
  hop: number
  frame: number
}

// scipy.stats.beta.cdf(linspace(0,1,101), 2, 18) 의 차분 - 임계값 0.01..1.00 각각의 가중치
const BETA_PROBS = [
  1.52737615e-02, 3.93421885e-02, 5.53391056e-02, 6.51272075e-02, 7.02105318e-02, 7.17952748e-02, 7.08413389e-02, 6.81058901e-02, 6.41800470e-02, 5.95196754e-02,
  5.44711422e-02, 4.92927676e-02, 4.41726192e-02, 3.92432029e-02, 3.45935307e-02, 3.02789803e-02, 2.63293003e-02, 2.27550657e-02, 1.95528440e-02, 1.67092928e-02,
  1.42043770e-02, 1.20138635e-02, 1.01112296e-02, 8.46909330e-03, 7.06026416e-03, 5.85848843e-03, 4.83895578e-03, 3.97861938e-03, 3.25637322e-03, 2.65312179e-03,
  2.15177053e-03, 1.73715974e-03, 1.39595989e-03, 1.11654234e-03, 8.88836192e-04, 7.04179552e-04, 5.55171110e-04, 4.35526408e-04, 3.39941780e-04, 2.63967839e-04,
  2.03893624e-04, 1.56641842e-04, 1.19675236e-04, 9.09137107e-05, 6.86616796e-05, 5.15449013e-05, 3.84560111e-05, 2.85079085e-05, 2.09941599e-05, 1.53555990e-05,
  1.11523526e-05, 8.04056974e-06, 5.75319549e-06, 4.08419484e-06, 2.87569496e-06, 2.00757832e-06, 1.38911817e-06, 9.52302827e-07, 6.46546491e-07, 4.34529352e-07,
  2.88950831e-07, 1.90015255e-07, 1.23500475e-07, 7.92866655e-08, 5.02454063e-08, 3.14083869e-08, 1.93512273e-08, 1.17412520e-08, 7.00902647e-09, 4.11238099e-09,
  2.36881725e-09, 1.33792533e-09, 7.39938777e-10, 4.00090738e-10, 2.11143769e-10, 1.08548837e-10, 5.42458301e-11, 2.62873057e-11, 1.23188126e-11, 5.56499291e-12,
  2.41473508e-12, 1.00219832e-12, 3.95905531e-13, 1.47992729e-13, 5.20694599e-14, 1.70974346e-14, 5.10702591e-15, 1.44328993e-15, 3.33066907e-16, 1.11022302e-16,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]
const N_THRESH = 100
const BOLTZMANN = 2
const NO_TROUGH_PROB = 0.01
const SWITCH_PROB = 0.01
const MAX_TRANSITION_RATE = 35.92   // 반음/초
const BINS_PER_SEMI = 10
const NEG = -1e30
const CHUNK = 8192                  // 역추적 청크(프레임)

interface FrameCands { bins: Uint16Array; freqs: Float32Array; logProbs: Float32Array; voiced: number }

export function pyin(y: Float32Array, opts: PyinOptions): PyinResult {
  const sr = opts.sr
  const fmin = opts.fmin ?? 150, fmax = opts.fmax ?? 1200
  const frame = opts.frameLength ?? 2048
  const win = opts.winLength ?? frame >> 1
  const hop = opts.hopLength ?? 256
  const onProgress = opts.onProgress
  if (fmax > sr / 2 || fmin >= fmax || fmin <= 0) throw new Error('pyin: fmin/fmax 범위가 잘못됨')

  const minP = Math.floor(sr / fmax)
  const maxP = Math.min(Math.ceil(sr / fmin), frame - win - 1)
  const nBins = Math.floor(12 * BINS_PER_SEMI * Math.log2(fmax / fmin)) + 1
  const half = frame >> 1
  const nFrames = 1 + Math.floor(y.length / hop)

  // center=True, reflect 패딩
  const x = new Float32Array(y.length + 2 * half)
  x.set(y, half)
  for (let k = 1; k <= half; k++) {
    x[half - k] = y[Math.min(k, y.length - 1)]
    x[half + y.length - 1 + k] = y[Math.max(0, y.length - 1 - k)]
  }

  // ---- 전이 가중치 (삼각창, 행 정규화) ----
  const maxSemi = Math.round(MAX_TRANSITION_RATE * 12 * hop / sr)
  const width = maxSemi * BINS_PER_SEMI + 1
  const hw = width >> 1
  const tri = new Float64Array(width)
  for (let k = 0; k < width; k++) tri[k] = 1 - Math.abs(k - hw) / (hw + 1)   // scipy triang(홀수 M)
  const logTri = new Float64Array(width)
  for (let k = 0; k < width; k++) logTri[k] = Math.log(tri[k])
  const logNorm = new Float64Array(nBins)
  for (let b = 0; b < nBins; b++) {
    let s = 0
    for (let k = -hw; k <= hw; k++) { const t = b + k; if (t >= 0 && t < nBins) s += tri[k + hw] }
    logNorm[b] = Math.log(s)
  }
  const logStay = Math.log(1 - SWITCH_PROB), logSwitch = Math.log(SWITCH_PROB)
  const logUniform = -Math.log(nBins)

  // ---- 작업 버퍼 ----
  const d = new Float64Array(maxP + 1)
  const cmnd = new Float64Array(maxP + 1)
  const troughIdx: number[] = []
  const probs = new Float64Array(maxP + 1)

  const f0 = new Float32Array(nFrames)
  const voicedProb = new Float32Array(nFrames)
  const times = new Float32Array(nFrames)

  // 비터비 상태
  let deltaU = new Float64Array(nBins).fill(logUniform)   // 첫 프레임 전: p_init = 무성 균등
  let deltaV = new Float64Array(nBins).fill(NEG)
  let prevCands: FrameCands | null = null
  let chunkStart = 0
  let bpU = new Int32Array(CHUNK * nBins)
  const chunkCands: FrameCands[] = []
  const chunkBpV: Int32Array[] = []
  let initFrame = true

  const finishChunk = (end: number, bestState: number) => {
    // end 프레임의 bestState에서 chunkStart까지 역추적
    let s = bestState
    for (let t = end; t >= chunkStart; t--) {
      const c = chunkCands[t - chunkStart]
      const local = t - chunkStart
      if (s < nBins) {
        let ci = 0; while (ci < c.bins.length && c.bins[ci] !== s) ci++
        f0[t] = c.freqs[ci]
        if (t > chunkStart) s = chunkBpV[local][ci]
      } else {
        f0[t] = 0
        if (t > chunkStart) s = bpU[local * nBins + (s - nBins)]
      }
    }
  }

  for (let i = 0; i < nFrames; i++) {
    const off = i * hop
    times[i] = off / sr

    // ---- CMND ----
    let cum = 0
    for (let tau = 1; tau <= maxP; tau++) {
      let s = 0
      const a = off, b = off + tau
      for (let j = 0; j < win; j++) { const diff = x[a + j] - x[b + j]; s += diff * diff }
      d[tau] = s; cum += s
      cmnd[tau] = s * tau / (cum + 1e-12)
    }

    // ---- 골 찾기 (minP..maxP 범위 안) ----
    troughIdx.length = 0
    for (let tau = minP; tau <= maxP; tau++) {
      const c = cmnd[tau]
      const isMin = tau === minP ? c < cmnd[tau + 1]
        : tau === maxP ? c < cmnd[tau - 1]
        : c < cmnd[tau - 1] && c <= cmnd[tau + 1]
      if (isMin) troughIdx.push(tau)
    }

    let cands: FrameCands
    if (troughIdx.length === 0) {
      cands = { bins: new Uint16Array(0), freqs: new Float32Array(0), logProbs: new Float32Array(0), voiced: 0 }
    } else {
      // ---- 골 확률: 임계값별 볼츠만 우선순위 × 베타 가중 ----
      const nT = troughIdx.length
      for (let t = 0; t < nT; t++) probs[t] = 0
      let gMin = 0
      for (let t = 1; t < nT; t++) if (cmnd[troughIdx[t]] < cmnd[troughIdx[gMin]]) gMin = t
      const hMin = cmnd[troughIdx[gMin]]
      const eL = Math.exp(-BOLTZMANN)
      for (let k = 0; k < N_THRESH; k++) {
        const thr = (k + 1) / N_THRESH
        let n = 0
        for (let t = 0; t < nT; t++) if (cmnd[troughIdx[t]] < thr) n++
        if (n === 0) continue
        const norm = (1 - eL) / (1 - Math.exp(-BOLTZMANN * n))
        let pos = 0
        for (let t = 0; t < nT; t++) {
          if (cmnd[troughIdx[t]] < thr) { probs[t] += norm * Math.exp(-BOLTZMANN * pos) * BETA_PROBS[k]; pos++ }
        }
      }
      let below = 0, betaSum = 0
      for (let k = 0; k < N_THRESH; k++) { if ((k + 1) / N_THRESH <= hMin) { betaSum += BETA_PROBS[k]; below++ } else break }
      if (below > 0) probs[gMin] += NO_TROUGH_PROB * betaSum

      // ---- 후보 → 음높이 칸 (포물선 보간) ----
      const binList: number[] = [], freqList: number[] = [], pList: number[] = []
      let vsum = 0
      for (let t = 0; t < nT; t++) {
        const p = probs[t]
        if (p <= 0) continue
        const tau = troughIdx[t]
        let shift = 0
        if (tau > minP && tau < maxP) {
          const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1]
          const den = a - 2 * b + c
          if (den !== 0) shift = (a - c) / (2 * den)
        }
        const freq = sr / (tau + shift)
        const bin = Math.min(nBins - 1, Math.max(0, Math.round(12 * BINS_PER_SEMI * Math.log2(freq / fmin))))
        const j = binList.indexOf(bin)
        if (j >= 0) { if (p > pList[j]) { pList[j] = p; freqList[j] = freq } }
        else { binList.push(bin); freqList.push(freq); pList.push(p) }
        vsum += p
      }
      const voiced = Math.min(1, vsum)
      cands = { bins: Uint16Array.from(binList), freqs: Float32Array.from(freqList), logProbs: Float32Array.from(pList.map((p) => Math.log(p))), voiced }
    }
    voicedProb[i] = cands.voiced
    const logObsU = Math.log(Math.max(1e-12, (1 - cands.voiced) / nBins))

    // ---- 비터비 한 걸음 ----
    const local = i - chunkStart
    const newU = new Float64Array(nBins)
    const newV = new Float64Array(nBins).fill(NEG)
    const bpV = new Int32Array(cands.bins.length)
    if (initFrame) {
      // p_init: 무성 균등, 유성 0
      for (let b = 0; b < nBins; b++) { newU[b] = logUniform + logObsU; bpU[local * nBins + b] = nBins + b }
      initFrame = false
    } else {
      const pc = prevCands!
      // 무성 목표
      for (let b = 0; b < nBins; b++) {
        let best = NEG, arg = nBins + b
        const lo = Math.max(0, b - hw), hi = Math.min(nBins - 1, b + hw)
        for (let s = lo; s <= hi; s++) {
          const v = deltaU[s] + logTri[s - b + hw] - logNorm[s] + logStay
          if (v > best) { best = v; arg = nBins + s }
        }
        for (let ci = 0; ci < pc.bins.length; ci++) {
          const s = pc.bins[ci]
          if (s < lo || s > hi) continue
          const v = deltaV[s] + logTri[s - b + hw] - logNorm[s] + logSwitch
          if (v > best) { best = v; arg = s }
        }
        newU[b] = best + logObsU
        bpU[local * nBins + b] = arg
      }
      // 유성 목표 (후보 칸만)
      for (let ci = 0; ci < cands.bins.length; ci++) {
        const b = cands.bins[ci]
        let best = NEG, arg = nBins + b
        const lo = Math.max(0, b - hw), hi = Math.min(nBins - 1, b + hw)
        for (let s = lo; s <= hi; s++) {
          const v = deltaU[s] + logTri[s - b + hw] - logNorm[s] + logSwitch
          if (v > best) { best = v; arg = nBins + s }
        }
        for (let cj = 0; cj < pc.bins.length; cj++) {
          const s = pc.bins[cj]
          if (s < lo || s > hi) continue
          const v = deltaV[s] + logTri[s - b + hw] - logNorm[s] + logStay
          if (v > best) { best = v; arg = s }
        }
        newV[b] = best + cands.logProbs[ci]
        bpV[ci] = arg
      }
    }
    deltaU = newU; deltaV = newV; prevCands = cands
    chunkCands.push(cands); chunkBpV.push(bpV)

    // ---- 청크 끝 또는 마지막 프레임: 역추적 ----
    if (local === CHUNK - 1 || i === nFrames - 1) {
      let best = NEG, bestState = nBins
      for (let b = 0; b < nBins; b++) if (deltaU[b] > best) { best = deltaU[b]; bestState = nBins + b }
      for (let ci = 0; ci < cands.bins.length; ci++) { const b = cands.bins[ci]; if (deltaV[b] > best) { best = deltaV[b]; bestState = b } }
      finishChunk(i, bestState)
      // 다음 청크는 선택된 상태에서만 이어간다 (경로 연속성)
      deltaU.fill(NEG); deltaV.fill(NEG)
      if (bestState < nBins) deltaV[bestState] = 0; else deltaU[bestState - nBins] = 0
      chunkStart = i + 1
      chunkCands.length = 0; chunkBpV.length = 0
      if (i !== nFrames - 1 && bpU.length < CHUNK * nBins) bpU = new Int32Array(CHUNK * nBins)
    }
    if (onProgress && (i & 255) === 0) onProgress(i / nFrames)
  }
  onProgress?.(1)
  return { f0, voicedProb, times, sr, hop, frame }
}
