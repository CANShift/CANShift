import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REBIND_FLASH_MS, useRebindFlashStore } from './rebind-flash.store'

describe('rebind flash store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useRebindFlashStore.setState({ flashId: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flashes a widget then clears after the flash window', () => {
    useRebindFlashStore.getState().flash('w1')
    expect(useRebindFlashStore.getState().flashId).toBe('w1')

    vi.advanceTimersByTime(REBIND_FLASH_MS)
    expect(useRebindFlashStore.getState().flashId).toBeNull()
  })

  it('a new flash replaces the previous one and restarts the timer', () => {
    useRebindFlashStore.getState().flash('w1')
    vi.advanceTimersByTime(REBIND_FLASH_MS / 2)
    useRebindFlashStore.getState().flash('w2')

    vi.advanceTimersByTime(REBIND_FLASH_MS / 2)
    expect(useRebindFlashStore.getState().flashId).toBe('w2')

    vi.advanceTimersByTime(REBIND_FLASH_MS / 2)
    expect(useRebindFlashStore.getState().flashId).toBeNull()
  })
})
