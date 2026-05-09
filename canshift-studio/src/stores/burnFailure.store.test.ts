// burnFailure.store.test.ts — Locks the store contract that backs the
// blocking burn-failure modal (#376).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBurnFailureStore } from './burnFailure.store'

describe('burnFailure.store', () => {
  beforeEach(() => {
    useBurnFailureStore.setState({ visible: false, details: null, onRetry: null })
  })

  it('starts hidden with no details', () => {
    const state = useBurnFailureStore.getState()
    expect(state.visible).toBe(false)
    expect(state.details).toBeNull()
    expect(state.onRetry).toBeNull()
  })

  it('show() captures details + retry callback and flips visible', () => {
    const retry = vi.fn()
    useBurnFailureStore.getState().show(
      {
        message: 'Device did not acknowledge (timeout)',
        hints: ['Check that the firmware is running.'],
        elapsedMs: 2400,
        schemaVersion: '1.12.0',
        payloadBytes: 1234,
      },
      retry
    )

    const state = useBurnFailureStore.getState()
    expect(state.visible).toBe(true)
    expect(state.details?.message).toBe('Device did not acknowledge (timeout)')
    expect(state.details?.hints).toHaveLength(1)
    expect(state.details?.elapsedMs).toBe(2400)
    expect(state.details?.schemaVersion).toBe('1.12.0')
    expect(state.details?.payloadBytes).toBe(1234)
    expect(state.onRetry).toBe(retry)
  })

  it('dismiss() clears the modal state', () => {
    useBurnFailureStore.getState().show(
      {
        message: 'Burn failed',
        hints: [],
        elapsedMs: 0,
        schemaVersion: '1.12.0',
        payloadBytes: 0,
      },
      () => {
        // noop
      }
    )

    useBurnFailureStore.getState().dismiss()

    const state = useBurnFailureStore.getState()
    expect(state.visible).toBe(false)
    expect(state.details).toBeNull()
    expect(state.onRetry).toBeNull()
  })
})
