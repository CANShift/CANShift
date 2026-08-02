import { describe, expect, it } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import type { CanFrameStats } from '../../stores/can-scan/accumulator'
import { boundFrameIds, unboundFrames } from './SignalsPanel'
import { parseHexFrameId } from '../../utils/frame-id'

const signal = (name: string, canFrameId: string): SignalDef => ({ name, canFrameId }) as SignalDef

const frame = (id: number): CanFrameStats => ({
  id,
  firstSeenMs: 0,
  lastSeenMs: 0,
  count: 1,
  rateHz: 1,
  lastDlc: 1,
  lastPayload: [0],
  byteValueCounts: [],
})

describe('SignalsPanel helpers', () => {
  it('parses hex frame ids and rejects garbage', () => {
    expect(parseHexFrameId('0x123')).toBe(0x123)
    expect(parseHexFrameId('0X1E005000')).toBe(0x1e005000)
    expect(parseHexFrameId('zz')).toBe(-1)
  })

  it('collects bound frame ids from the signal map', () => {
    const ids = boundFrameIds([signal('rpm', '0x360'), signal('speed', '0x361')])
    expect(ids.has(0x360)).toBe(true)
    expect(ids.has(0x361)).toBe(true)
    expect(ids.has(0x999)).toBe(false)
  })

  it('lists only frames no signal claims, sorted by id', () => {
    const frames = new Map<number, CanFrameStats>([
      [0x999, frame(0x999)],
      [0x360, frame(0x360)],
      [0x100, frame(0x100)],
    ])
    const result = unboundFrames(frames, [signal('rpm', '0x360')])
    expect(result.map((f) => f.id)).toEqual([0x100, 0x999])
  })

  it('returns every frame when no signals are bound', () => {
    const frames = new Map<number, CanFrameStats>([[0x1, frame(0x1)]])
    expect(unboundFrames(frames, [])).toHaveLength(1)
  })
})
