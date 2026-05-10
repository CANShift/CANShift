// bootLoop.store.test.ts — Behaviour contract for the boot-loop detector
// store (#498). Sliding window, threshold, dismissal semantics, context cap.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  BOOT_LOOP_THRESHOLD,
  BOOT_LOOP_WINDOW_MS,
  CONTEXT_LINES,
  type CapturedLine,
  useBootLoopStore,
} from './bootLoop.store'

function resetStore(): void {
  useBootLoopStore.setState({
    looping: false,
    bootMarkers: [],
    lastVersion: null,
    lastBootContext: [],
    detectedAt: null,
    dismissedAt: null,
  })
}

function makeContext(count: number): CapturedLine[] {
  return Array.from({ length: count }, (_, i) => ({
    level: 'I',
    tag: 'CTX',
    message: `line ${String(i)}`,
    timestampMs: i,
  }))
}

describe('bootLoop.store', () => {
  beforeEach(() => {
    resetStore()
  })

  it('starts idle with no markers and no context', () => {
    const state = useBootLoopStore.getState()
    expect(state.looping).toBe(false)
    expect(state.bootMarkers).toEqual([])
    expect(state.lastVersion).toBeNull()
    expect(state.lastBootContext).toEqual([])
    expect(state.detectedAt).toBeNull()
    expect(state.dismissedAt).toBeNull()
  })

  it('does not flag looping after a single boot marker', () => {
    useBootLoopStore.getState().recordBootMarker(1_000, '0.8.0', [])
    const state = useBootLoopStore.getState()
    expect(state.looping).toBe(false)
    expect(state.bootMarkers).toHaveLength(1)
    expect(state.lastVersion).toBe('0.8.0')
  })

  it('flags looping when threshold markers land within the window', () => {
    const ctx = makeContext(5)
    const store = useBootLoopStore.getState()
    store.recordBootMarker(1_000, '0.8.0', ctx)
    store.recordBootMarker(3_000, '0.8.0', ctx)
    store.recordBootMarker(5_000, '0.8.0', ctx)

    const state = useBootLoopStore.getState()
    expect(state.looping).toBe(true)
    expect(state.detectedAt).toBe(5_000)
    expect(state.lastVersion).toBe('0.8.0')
    expect(state.lastBootContext).toHaveLength(5)
  })

  it('does NOT flag looping when markers are spread beyond the window', () => {
    const store = useBootLoopStore.getState()
    store.recordBootMarker(0, '0.8.0', [])
    store.recordBootMarker(BOOT_LOOP_WINDOW_MS + 1_000, '0.8.0', [])
    store.recordBootMarker(2 * BOOT_LOOP_WINDOW_MS + 2_000, '0.8.0', [])

    const state = useBootLoopStore.getState()
    expect(state.looping).toBe(false)
    // Pruning keeps only the most recent marker — earlier ones fall off.
    expect(state.bootMarkers).toHaveLength(1)
  })

  it('reset() clears markers and context but preserves dismissedAt', () => {
    const store = useBootLoopStore.getState()
    store.recordBootMarker(1_000, '0.8.0', makeContext(3))
    store.recordBootMarker(2_000, '0.8.0', makeContext(3))
    store.recordBootMarker(3_000, '0.8.0', makeContext(3))
    store.dismissForSession()
    const dismissedAtBefore = useBootLoopStore.getState().dismissedAt
    expect(dismissedAtBefore).not.toBeNull()

    useBootLoopStore.getState().reset()

    const state = useBootLoopStore.getState()
    expect(state.looping).toBe(false)
    expect(state.bootMarkers).toEqual([])
    expect(state.lastBootContext).toEqual([])
    expect(state.lastVersion).toBeNull()
    expect(state.detectedAt).toBeNull()
    expect(state.dismissedAt).toBe(dismissedAtBefore)
  })

  it('dismissForSession() clears looping and re-arms after a fresh window', () => {
    const store = useBootLoopStore.getState()
    store.recordBootMarker(1_000, '0.8.0', [])
    store.recordBootMarker(2_000, '0.8.0', [])
    store.recordBootMarker(3_000, '0.8.0', [])
    expect(useBootLoopStore.getState().looping).toBe(true)

    useBootLoopStore.getState().dismissForSession()
    const dismissedAt = useBootLoopStore.getState().dismissedAt
    expect(useBootLoopStore.getState().looping).toBe(false)
    expect(dismissedAt).not.toBeNull()

    // A fresh window strictly AFTER the dismissal must re-trigger.
    const after = (dismissedAt ?? 0) + 1_000
    useBootLoopStore.getState().recordBootMarker(after, '0.8.0', [])
    useBootLoopStore.getState().recordBootMarker(after + 1_000, '0.8.0', [])
    useBootLoopStore.getState().recordBootMarker(after + 2_000, '0.8.0', [])
    expect(useBootLoopStore.getState().looping).toBe(true)
  })

  it('caps lastBootContext at CONTEXT_LINES, keeping the most recent lines', () => {
    const ctx = makeContext(CONTEXT_LINES + 10)
    useBootLoopStore.getState().recordBootMarker(1_000, '0.8.0', ctx)

    const state = useBootLoopStore.getState()
    expect(state.lastBootContext).toHaveLength(CONTEXT_LINES)
    // The slice keeps the LAST N entries (closest to the marker).
    expect(state.lastBootContext[0]?.message).toBe(`line ${String(10)}`)
    expect(state.lastBootContext.at(-1)?.message).toBe(`line ${String(CONTEXT_LINES + 10 - 1)}`)
  })

  it('exports BOOT_LOOP_THRESHOLD as a positive integer', () => {
    expect(BOOT_LOOP_THRESHOLD).toBeGreaterThan(0)
    expect(Number.isInteger(BOOT_LOOP_THRESHOLD)).toBe(true)
  })
})
