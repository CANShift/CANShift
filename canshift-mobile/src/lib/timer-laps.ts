export interface SessionLap {
  index: number
  lapMs: number
  totalMs: number
}

export interface IncomingLap extends SessionLap {
  sessionId: number
}

export interface ActiveBucket {
  sessionId: number
  lastIndex: number
}

export const startsNewBucket = (active: ActiveBucket | null, lap: IncomingLap): boolean => {
  if (active === null) return true
  if (lap.sessionId !== active.sessionId) return true
  return lap.index <= active.lastIndex && lap.index === 1
}

export const insertLap = (laps: readonly SessionLap[], lap: SessionLap): SessionLap[] => {
  if (laps.some((existing) => existing.index === lap.index)) return [...laps]
  return [...laps, lap].sort((a, b) => a.index - b.index)
}
