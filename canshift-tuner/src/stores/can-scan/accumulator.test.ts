import { describe, expect, it } from 'vitest'
import { createScanAccumulator, RATE_WINDOW_MS } from './accumulator'

describe('scan accumulator', () => {
  it('accumulates per-id stats across frames', () => {
    const acc = createScanAccumulator()
    acc.ingest({ id: 0x123, len: 2, data: [0x0a, 0x0b] }, 0)
    acc.ingest({ id: 0x123, len: 2, data: [0x0c, 0x0d] }, 100)
    acc.ingest({ id: 0x456, len: 1, data: [0xff] }, 150)

    const snap = acc.snapshot(200)
    expect(snap.totalFrames).toBe(3)
    expect(snap.frames.size).toBe(2)

    const first = snap.frames.get(0x123)
    expect(first?.count).toBe(2)
    expect(first?.firstSeenMs).toBe(0)
    expect(first?.lastSeenMs).toBe(100)
    expect(first?.lastPayload).toEqual([0x0c, 0x0d])
    expect(first?.byteValueCounts[0]?.get(0x0a)).toBe(1)
    expect(first?.byteValueCounts[0]?.get(0x0c)).toBe(1)
  })

  it('drops frames outside the rate window from rate but not from count', () => {
    const acc = createScanAccumulator()
    acc.ingest({ id: 0x100, len: 1, data: [1] }, 0)
    acc.ingest({ id: 0x100, len: 1, data: [2] }, RATE_WINDOW_MS + 500)

    const snap = acc.snapshot(RATE_WINDOW_MS + 600)
    const stats = snap.frames.get(0x100)
    expect(stats?.count).toBe(2)
    expect(stats?.rateHz).toBe(1)
    expect(snap.totalRate).toBe(1)
  })

  it('reset clears everything including startedAt', () => {
    const acc = createScanAccumulator()
    acc.markStarted(10)
    acc.ingest({ id: 0x1, len: 1, data: [0] }, 20)
    acc.reset()

    const snap = acc.snapshot(30)
    expect(snap.startedAt).toBeNull()
    expect(snap.totalFrames).toBe(0)
    expect(snap.frames.size).toBe(0)
  })

  it('ranks a churning id first in the learn window', () => {
    const acc = createScanAccumulator()
    acc.ingest({ id: 0x100, len: 1, data: [1] }, 0)
    acc.ingest({ id: 0x200, len: 1, data: [1] }, 0)

    acc.startLearn()
    for (let i = 0; i < 5; i++) {
      acc.ingest({ id: 0x100, len: 1, data: [i % 2] }, 10 + i)
      acc.ingest({ id: 0x200, len: 1, data: [1] }, 10 + i)
    }
    acc.stopLearn()

    const learn = acc.snapshot(100).learn
    expect(learn).not.toBeNull()
    expect(learn?.active).toBe(false)
    expect(learn?.scores.get(0x100)).toBe(5)
    expect(learn?.scores.get(0x200)).toBeUndefined()
  })

  it('ignores changes outside the learn window and counts first-seen-in-window ids from their second frame', () => {
    const acc = createScanAccumulator()
    acc.ingest({ id: 0x1, len: 1, data: [1] }, 0)
    acc.ingest({ id: 0x1, len: 1, data: [2] }, 1)

    acc.startLearn()
    acc.ingest({ id: 0x2, len: 1, data: [9] }, 10)
    acc.ingest({ id: 0x2, len: 1, data: [8] }, 11)
    acc.stopLearn()

    acc.ingest({ id: 0x1, len: 1, data: [3] }, 20)

    const learn = acc.snapshot(100).learn
    expect(learn?.scores.get(0x1)).toBeUndefined()
    expect(learn?.scores.get(0x2)).toBe(1)
  })

  it('clearLearn removes the window entirely', () => {
    const acc = createScanAccumulator()
    acc.startLearn()
    acc.ingest({ id: 0x1, len: 1, data: [1] }, 0)
    acc.clearLearn()

    expect(acc.snapshot(10).learn).toBeNull()
  })

  it('truncates payloads beyond 8 bytes', () => {
    const acc = createScanAccumulator()
    acc.ingest({ id: 0x2, len: 10, data: Array.from({ length: 10 }, (_, i) => i) }, 0)

    const stats = acc.snapshot(1).frames.get(0x2)
    expect(stats?.lastPayload).toHaveLength(8)
  })
})
