// device.store.test.ts — Locks the SD-state plumbing introduced for issue #252
// and the firmwareCheck slice that replaced the old firmware popup.
//
// Focused on the slices that needed dedicated coverage. The legacy slices
// (status, burnPhase, …) are exercised indirectly by the higher-level tests
// and don't need duplicate coverage here.

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
      firmwareCheck: { kind: 'idle' },
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

describe('device.store — firmwareCheck slice', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      status: 'disconnected',
      portPath: null,
      connected: false,
      syncing: false,
      isDayMode: null,
      sdState: 'unknown',
      firmwareCheck: { kind: 'idle' },
    })
  })

  it("defaults to { kind: 'idle' }", () => {
    expect(useDeviceStore.getState().firmwareCheck).toEqual({ kind: 'idle' })
  })

  it('setFirmwareCheck records each variant of the discriminated union', () => {
    const setFirmwareCheck = useDeviceStore.getState().setFirmwareCheck

    setFirmwareCheck({ kind: 'probing' })
    expect(useDeviceStore.getState().firmwareCheck).toEqual({ kind: 'probing' })

    setFirmwareCheck({ kind: 'no_firmware' })
    expect(useDeviceStore.getState().firmwareCheck).toEqual({ kind: 'no_firmware' })

    const upToDate = { kind: 'up_to_date' as const, version: '0.9.0', checkedAt: 1_700_000_000 }
    setFirmwareCheck(upToDate)
    expect(useDeviceStore.getState().firmwareCheck).toEqual(upToDate)

    const updateAvailable = {
      kind: 'update_available' as const,
      version: '0.9.0',
      latestVersion: '1.0.0',
      checkedAt: 1_700_000_000,
    }
    setFirmwareCheck(updateAvailable)
    expect(useDeviceStore.getState().firmwareCheck).toEqual(updateAvailable)
  })

  it('disconnect resets firmwareCheck to idle so the next connect re-probes', () => {
    useDeviceStore
      .getState()
      .setFirmwareCheck({ kind: 'up_to_date', version: '1.0.0', checkedAt: 0 })
    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().firmwareCheck).toEqual({ kind: 'idle' })
  })
})
