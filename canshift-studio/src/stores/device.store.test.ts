// device.store.test.ts — Locks the firmwareCheck slice that replaced the
// old firmware popup.
//
// Focused on the slices that needed dedicated coverage. The legacy slices
// (status, burnPhase, …) are exercised indirectly by the higher-level tests
// and don't need duplicate coverage here.

import { beforeEach, describe, expect, it } from 'vitest'
import { useDeviceStore } from './device.store'

describe('device.store — firmwareCheck slice', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      status: 'disconnected',
      portPath: null,
      connected: false,
      syncing: false,
      isDayMode: null,
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
