// device.store.test.ts — Locks the SD-state plumbing introduced for issue #252.
//
// Focused on the additive sdState slice: default, setter, and the disconnect
// reset. The legacy slices (status, burnPhase, …) are exercised indirectly by
// the higher-level tests and don't need duplicate coverage here.

import { beforeEach, describe, expect, it } from 'vitest'
import { useDeviceStore } from './device.store'

describe('device.store — sdState (issue #252)', () => {
  beforeEach(() => {
    // Zustand stores are module singletons — reset to a known baseline so
    // tests don't leak state between runs.
    useDeviceStore.setState({
      status: 'disconnected',
      portPath: null,
      connected: false,
      syncing: false,
      isDayMode: null,
      sdState: 'unknown',
    })
  })

  it("defaults to 'unknown' so older firmware keeps full UX", () => {
    expect(useDeviceStore.getState().sdState).toBe('unknown')
  })

  it('setSdState records the firmware-reported state', () => {
    useDeviceStore.getState().setSdState('no_card')
    expect(useDeviceStore.getState().sdState).toBe('no_card')

    useDeviceStore.getState().setSdState('ok')
    expect(useDeviceStore.getState().sdState).toBe('ok')
  })

  it("disconnect resets sdState to 'unknown' so the next probe starts clean", () => {
    useDeviceStore.getState().setSdState('mount_failed')
    expect(useDeviceStore.getState().sdState).toBe('mount_failed')

    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().sdState).toBe('unknown')
  })
})
