/** 프레임 단위 음높이 추적 결과. f0가 0이면 무성(소리 없음/판정 불가). */
export interface PitchTrack {
  sr: number            // 분석에 쓴 샘플레이트 (재생 버퍼와 다를 수 있음)
  hop: number
  frame: number
  times: Float32Array   // 각 프레임의 시각(초) = i * hop / sr
  f0: Float32Array      // Hz, 0 = 무성
  voicedProb: Float32Array
}

export interface Project {
  name: string
  buffer: AudioBuffer   // 재생용 (원래 샘플레이트)
  duration: number
  peaks: Float32Array   // 파형 봉우리 - 분석용 모노에서 PEAK_STEP 샘플마다 절대값 최대
  pitch: PitchTrack
}

export const ANALYSIS_SR = 22050
export const PEAK_STEP = 256
