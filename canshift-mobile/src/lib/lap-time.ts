export const LAP_TIME_PLACEHOLDER = '--:--.---'

const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1_000

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

export const formatLapMs = (ms: number): string => {
  const clamped = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(clamped / MS_PER_MINUTE)
  const seconds = Math.floor((clamped % MS_PER_MINUTE) / MS_PER_SECOND)
  const millis = clamped % MS_PER_SECOND
  return `${String(minutes)}:${pad(seconds, 2)}.${pad(millis, 3)}`
}
