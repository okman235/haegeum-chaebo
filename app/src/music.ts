/** 음높이 단위 변환. midi 는 실수(소수 = 센트)로도 쓴다. */
export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11])

export const hzToMidi = (f: number, a4 = 440) => 69 + 12 * Math.log2(f / a4)
export const midiToHz = (m: number, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12)
export const pitchClass = (m: number) => ((Math.round(m) % 12) + 12) % 12
export const octaveOf = (m: number) => Math.floor(Math.round(m) / 12) - 1
export const noteName = (m: number) => `${NAMES[pitchClass(m)]}${octaveOf(m)}`
