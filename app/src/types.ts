/** 프레임 단위 음높이 추적 결과. f0가 0이면 무성(소리 없음/판정 불가). */
export interface PitchTrack {
  times: Float32Array   // 각 프레임의 중심 시각(초)
  f0: Float32Array      // Hz, 0 = 무성
  frame: number
  hop: number
}

export interface Project {
  name: string
  buffer: AudioBuffer
  sr: number
  duration: number
  peaks: Float32Array   // 파형 봉우리 (PEAK_STEP 샘플마다 절대값 최대)
  pitch: PitchTrack
}

export const PEAK_STEP = 512
