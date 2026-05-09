// canHealth.store.test.ts — Behaviour contract for the CAN bus health stats
// store. Updated every ~2s when a CAN health packet arrives over USB.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanHealthStore } from './canHealth.store'

describe('canHealth.store', () => {
  beforeEach(() => {
    useCanHealthStore.setState({ fps: null, errors: null, updatedAt: null })
  })

  it('starts with all stats null', () => {
    const state = useCanHealthStore.getState()
    expect(state.fps).toBeNull()
    expect(state.errors).toBeNull()
    expect(state.updatedAt).toBeNull()
  })

  it('update() records fps, errors, and stamps updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'))
    try {
      useCanHealthStore.getState().update(120, 3)
      const state = useCanHealthStore.getState()
      expect(state.fps).toBe(120)
      expect(state.errors).toBe(3)
      expect(state.updatedAt).toBe(new Date('2026-05-09T10:00:00Z').getTime())
    } finally {
      vi.useRealTimers()
    }
  })

  it('update() overwrites a previous reading rather than accumulating', () => {
    useCanHealthStore.getState().update(80, 0)
    useCanHealthStore.getState().update(40, 5)

    const state = useCanHealthStore.getState()
    expect(state.fps).toBe(40)
    expect(state.errors).toBe(5)
  })

  it('update() accepts zero values (idle bus)', () => {
    useCanHealthStore.getState().update(0, 0)
    const state = useCanHealthStore.getState()
    expect(state.fps).toBe(0)
    expect(state.errors).toBe(0)
    expect(state.updatedAt).not.toBeNull()
  })
})
