// canScanner.store.test.ts — Behaviour contract for the live CAN frame
// table. Locks frame ingestion (new + update), prevData snapshotting across
// batches, rate windowing, and clearFrames resetting the rate ring buffer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanFrame } from '../services/ipc.service'
import { useCanScannerStore } from './canScanner.store'

function makeFrame(id: number, data: number[]): CanFrame {
  return { id, len: data.length, data }
}

describe('canScanner.store', () => {
  beforeEach(() => {
    useCanScannerStore.setState({ scanning: false, frames: {} })
    // Always clear the module-private timestamp ring buffer between tests
    // by exercising the documented public action.
    useCanScannerStore.getState().clearFrames()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not-scanning with an empty frame map', () => {
    const state = useCanScannerStore.getState()
    expect(state.scanning).toBe(false)
    expect(state.frames).toEqual({})
  })

  it('setScanningState() flips the flag', () => {
    useCanScannerStore.getState().setScanningState(true)
    expect(useCanScannerStore.getState().scanning).toBe(true)

    useCanScannerStore.getState().setScanningState(false)
    expect(useCanScannerStore.getState().scanning).toBe(false)
  })

  it('ingestBatch() with an empty array is a no-op', () => {
    useCanScannerStore.getState().ingestBatch([])
    expect(useCanScannerStore.getState().frames).toEqual({})
  })

  it('ingestBatch() inserts a brand-new frame entry with count=1 and prevData=[]', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))

    useCanScannerStore.getState().ingestBatch([makeFrame(0x123, [1, 2, 3, 4])])

    const entry = useCanScannerStore.getState().frames[0x123]
    expect(entry).toBeDefined()
    expect(entry?.id).toBe(0x123)
    expect(entry?.dlc).toBe(4)
    expect(entry?.data).toEqual([1, 2, 3, 4])
    expect(entry?.prevData).toEqual([])
    expect(entry?.count).toBe(1)
    expect(entry?.firstSeen).toBe(entry?.lastSeen)
  })

  it('ingestBatch() updates an existing frame: count++, refreshes data, snapshots prevData', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))

    useCanScannerStore.getState().ingestBatch([makeFrame(0x123, [1, 2, 3, 4])])

    vi.setSystemTime(new Date('2026-05-09T10:00:01Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x123, [9, 9, 9, 9])])

    const entry = useCanScannerStore.getState().frames[0x123]
    expect(entry?.count).toBe(2)
    expect(entry?.data).toEqual([9, 9, 9, 9])
    // prevData reflects the data captured BEFORE this batch — not the prior
    // batch's prevData. Locks the bytes-changed highlight contract.
    expect(entry?.prevData).toEqual([1, 2, 3, 4])
  })

  it('ingestBatch() snapshots prevData ONCE per id when the same id appears twice in one batch', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))

    useCanScannerStore.getState().ingestBatch([makeFrame(0x200, [1, 1])])

    vi.setSystemTime(new Date('2026-05-09T10:00:01Z'))
    // Two frames same id in a single batch. prevData must be the data
    // BEFORE this batch (= [1, 1]), NOT the value mid-batch (= [2, 2]).
    useCanScannerStore.getState().ingestBatch([makeFrame(0x200, [2, 2]), makeFrame(0x200, [3, 3])])

    const entry = useCanScannerStore.getState().frames[0x200]
    expect(entry?.data).toEqual([3, 3])
    expect(entry?.prevData).toEqual([1, 1])
    expect(entry?.count).toBe(3)
  })

  it('ingestBatch() handles multiple distinct frame ids in one batch', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))

    useCanScannerStore
      .getState()
      .ingestBatch([makeFrame(0x100, [1]), makeFrame(0x200, [2]), makeFrame(0x300, [3])])

    const frames = useCanScannerStore.getState().frames
    expect(Object.keys(frames)).toHaveLength(3)
    expect(frames[0x100]?.data).toEqual([1])
    expect(frames[0x200]?.data).toEqual([2])
    expect(frames[0x300]?.data).toEqual([3])
  })

  it('rate is rounded to one decimal and reflects frames in the last 2s window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))
    // 4 frames in 1 second → 4 / 2 = 2 fps in the rolling 2s window.
    useCanScannerStore.getState().ingestBatch([makeFrame(0x400, [0])])
    vi.setSystemTime(new Date('2026-05-09T10:00:00.500Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x400, [0])])
    vi.setSystemTime(new Date('2026-05-09T10:00:00.700Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x400, [0])])
    vi.setSystemTime(new Date('2026-05-09T10:00:01.000Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x400, [0])])

    const entry = useCanScannerStore.getState().frames[0x400]
    expect(entry?.rate).toBeCloseTo(2.0, 5)
  })

  it('rate window forgets timestamps older than 2s', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x401, [0])])

    // Skip past the 2s window — the old timestamp should drop out.
    vi.setSystemTime(new Date('2026-05-09T10:00:05Z'))
    useCanScannerStore.getState().ingestBatch([makeFrame(0x401, [0])])

    const entry = useCanScannerStore.getState().frames[0x401]
    // Only 1 frame in last 2s → 1 / 2 = 0.5 fps
    expect(entry?.rate).toBeCloseTo(0.5, 5)
  })

  it('clearFrames() empties the frame map AND resets rate ring buffer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))

    useCanScannerStore.getState().ingestBatch([makeFrame(0x500, [0])])
    useCanScannerStore.getState().ingestBatch([makeFrame(0x500, [0])])

    useCanScannerStore.getState().clearFrames()
    expect(useCanScannerStore.getState().frames).toEqual({})

    // After clear, ingesting once → rate must be 1 / 2 = 0.5 (not 3/2)
    useCanScannerStore.getState().ingestBatch([makeFrame(0x500, [0])])
    const entry = useCanScannerStore.getState().frames[0x500]
    expect(entry?.rate).toBeCloseTo(0.5, 5)
    expect(entry?.count).toBe(1)
  })
})
