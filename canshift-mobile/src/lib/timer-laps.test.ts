import { insertLap, startsNewBucket, type IncomingLap } from './timer-laps'

const lap = (overrides: Partial<IncomingLap> = {}): IncomingLap => ({
  sessionId: 1,
  index: 1,
  lapMs: 1000,
  totalMs: 1000,
  ...overrides,
})

describe('startsNewBucket', () => {
  it('starts a bucket when none is active', () => {
    expect(startsNewBucket(null, lap())).toBe(true)
  })

  it('starts a bucket when the session id changes', () => {
    expect(startsNewBucket({ sessionId: 1, lastIndex: 3 }, lap({ sessionId: 2, index: 4 }))).toBe(
      true
    )
  })

  it('continues the bucket for ascending indexes in the same session', () => {
    expect(startsNewBucket({ sessionId: 1, lastIndex: 3 }, lap({ index: 4 }))).toBe(false)
  })

  it('treats a replayed duplicate index as the same bucket', () => {
    expect(startsNewBucket({ sessionId: 1, lastIndex: 3 }, lap({ index: 2 }))).toBe(false)
  })

  it('starts a new bucket when index 1 reappears in the same session (firmware reboot)', () => {
    expect(startsNewBucket({ sessionId: 1, lastIndex: 3 }, lap({ index: 1 }))).toBe(true)
  })
})

describe('insertLap', () => {
  const existing = [
    { index: 1, lapMs: 1000, totalMs: 1000 },
    { index: 3, lapMs: 900, totalMs: 2900 },
  ]

  it('inserts in index order', () => {
    const result = insertLap(existing, { index: 2, lapMs: 1000, totalMs: 2000 })
    expect(result.map((l) => l.index)).toEqual([1, 2, 3])
  })

  it('dedupes by index', () => {
    const result = insertLap(existing, { index: 3, lapMs: 999, totalMs: 999 })
    expect(result).toEqual(existing)
  })

  it('does not mutate the input array', () => {
    const before = [...existing]
    insertLap(existing, { index: 2, lapMs: 1000, totalMs: 2000 })
    expect(existing).toEqual(before)
  })
})
