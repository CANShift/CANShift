// device.store.test.ts — Locks the firmwareCheck slice that replaced the
// old firmware popup, plus full coverage for connection / burn / sim slices.

import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDeviceStore } from './device.store'

function makeConfig(name: string): DashboardConfig {
  return {
    version: '1.10.0',
    name,
    description: '',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    topBar: { height: 16, bgColor: '#0D0D0D', textColor: '#AAAAAA' },
    pages: [
      {
        id: 'p1',
        backgroundImage: null,
        backgroundColor: '#000000',
        showTopBar: true,
        palette: {
          surface: '#1E1E1E',
          primary: '#FF4444',
          accent: '#FF8800',
          text: '#FFFFFF',
          textDim: '#888888',
          warning: '#FF8800',
          danger: '#FF4444',
          success: '#00CC44',
        },
        widgets: [],
      },
    ],
  }
}

function resetDeviceStore(): void {
  useDeviceStore.setState({
    status: 'disconnected',
    portPath: null,
    transport: null,
    wifiHost: null,
    firmwareVersion: null,
    lastSyncAt: null,
    errorMessage: null,
    connected: false,
    syncing: false,
    simulationMode: false,
    firmwareCheck: { kind: 'idle' },
    firmwareCheckTick: 0,
    isDayMode: null,
    lastPushedConfig: null,
    burnPhase: 'idle',
    flashing: false,
  })
}

describe('device.store — firmwareCheck slice', () => {
  beforeEach(() => {
    resetDeviceStore()
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

  it('also covers the check_failed variant', () => {
    useDeviceStore
      .getState()
      .setFirmwareCheck({ kind: 'check_failed', version: '0.8.0', checkedAt: 1 })
    expect(useDeviceStore.getState().firmwareCheck).toEqual({
      kind: 'check_failed',
      version: '0.8.0',
      checkedAt: 1,
    })
  })

  it('requestFirmwareRecheck() bumps the tick counter', () => {
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(0)
    useDeviceStore.getState().requestFirmwareRecheck()
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(1)
    useDeviceStore.getState().requestFirmwareRecheck()
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(2)
  })

  it('setDisconnected() also zeroes the firmware-check tick counter', () => {
    useDeviceStore.getState().requestFirmwareRecheck()
    useDeviceStore.getState().requestFirmwareRecheck()
    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(0)
  })
})

describe('device.store — connection slice', () => {
  beforeEach(() => {
    resetDeviceStore()
  })

  it('setConnected() flips status, port, and clears stale error / syncing flags', () => {
    useDeviceStore.setState({
      status: 'error',
      errorMessage: 'old error',
      syncing: true,
    })

    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')

    const state = useDeviceStore.getState()
    expect(state.status).toBe('connected')
    expect(state.portPath).toBe('/dev/tty.usbserial-A')
    expect(state.connected).toBe(true)
    expect(state.syncing).toBe(false)
    expect(state.errorMessage).toBeNull()
  })

  it('setDisconnected() clears port + connected + isDayMode + syncing', () => {
    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')
    useDeviceStore.getState().setIsDayMode(true)
    useDeviceStore.setState({ syncing: true })

    useDeviceStore.getState().setDisconnected()

    const state = useDeviceStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.portPath).toBeNull()
    expect(state.connected).toBe(false)
    expect(state.isDayMode).toBeNull()
    expect(state.syncing).toBe(false)
  })

  it('setSyncing(true) reports burning even when previously connected', () => {
    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')
    useDeviceStore.getState().setSyncing(true)

    const state = useDeviceStore.getState()
    expect(state.status).toBe('burning')
    expect(state.syncing).toBe(true)
  })

  it('setSyncing(false) returns to connected when the device is connected', () => {
    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')
    useDeviceStore.getState().setSyncing(true)
    useDeviceStore.getState().setSyncing(false)

    expect(useDeviceStore.getState().status).toBe('connected')
  })

  it('setSyncing(false) returns to disconnected when the device is not connected', () => {
    useDeviceStore.getState().setSyncing(true)
    useDeviceStore.getState().setSyncing(false)

    expect(useDeviceStore.getState().status).toBe('disconnected')
  })

  it('setSyncComplete() stamps lastSyncAt and clears syncing', () => {
    const at = new Date('2026-05-09T12:00:00Z')
    useDeviceStore.getState().setSyncing(true)

    useDeviceStore.getState().setSyncComplete(at)

    const state = useDeviceStore.getState()
    expect(state.status).toBe('connected')
    expect(state.lastSyncAt).toBe(at)
    expect(state.syncing).toBe(false)
  })

  it('setError() switches to error status, records the message, kills syncing', () => {
    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')
    useDeviceStore.getState().setSyncing(true)

    useDeviceStore.getState().setError('cable yanked')

    const state = useDeviceStore.getState()
    expect(state.status).toBe('error')
    expect(state.errorMessage).toBe('cable yanked')
    expect(state.syncing).toBe(false)
  })

  it('clearError() returns to connected when the device is still connected', () => {
    useDeviceStore.getState().setConnected('/dev/tty.usbserial-A')
    useDeviceStore.getState().setError('boom')

    useDeviceStore.getState().clearError()

    const state = useDeviceStore.getState()
    expect(state.status).toBe('connected')
    expect(state.errorMessage).toBeNull()
  })

  it('clearError() drops to disconnected when nothing is connected', () => {
    useDeviceStore.getState().setError('boom')
    useDeviceStore.getState().clearError()

    const state = useDeviceStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.errorMessage).toBeNull()
  })

  it('setFirmwareVersion() persists null / string both', () => {
    useDeviceStore.getState().setFirmwareVersion('1.2.3')
    expect(useDeviceStore.getState().firmwareVersion).toBe('1.2.3')

    useDeviceStore.getState().setFirmwareVersion(null)
    expect(useDeviceStore.getState().firmwareVersion).toBeNull()
  })

  it('setIsDayMode() accepts true / false / null', () => {
    useDeviceStore.getState().setIsDayMode(true)
    expect(useDeviceStore.getState().isDayMode).toBe(true)
    useDeviceStore.getState().setIsDayMode(false)
    expect(useDeviceStore.getState().isDayMode).toBe(false)
    useDeviceStore.getState().setIsDayMode(null)
    expect(useDeviceStore.getState().isDayMode).toBeNull()
  })
})

describe('device.store — simulation slice', () => {
  beforeEach(() => {
    resetDeviceStore()
  })

  it('enterSimulation() reports as connected without a real port', () => {
    useDeviceStore.getState().enterSimulation()

    const state = useDeviceStore.getState()
    expect(state.simulationMode).toBe(true)
    expect(state.status).toBe('connected')
    expect(state.connected).toBe(true)
    expect(state.portPath).toBeNull()
  })

  it('exitSimulation() flips back to disconnected', () => {
    useDeviceStore.getState().enterSimulation()
    useDeviceStore.getState().exitSimulation()

    const state = useDeviceStore.getState()
    expect(state.simulationMode).toBe(false)
    expect(state.status).toBe('disconnected')
    expect(state.connected).toBe(false)
    expect(state.portPath).toBeNull()
  })
})

describe('device.store — burn / flash / lastPushedConfig', () => {
  beforeEach(() => {
    resetDeviceStore()
  })

  it('setLastPushedConfig() records the most recent burned config', () => {
    const config = makeConfig('burned')

    useDeviceStore.getState().setLastPushedConfig(config)

    expect(useDeviceStore.getState().lastPushedConfig).toBe(config)
  })

  it('setDisconnected() clears lastPushedConfig (audit S-L-6)', () => {
    // Keeping the previous device's config after disconnect makes the diff
    // dialog show "Modified" against an image that is no longer connected.
    useDeviceStore.getState().setLastPushedConfig(makeConfig('previous'))
    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().lastPushedConfig).toBeNull()
  })

  it('setBurnPhase() walks the burn lifecycle (idle → pushing → rebooting → done)', () => {
    const phases = ['idle', 'pushing', 'rebooting', 'done'] as const

    for (const phase of phases) {
      useDeviceStore.getState().setBurnPhase(phase)
      expect(useDeviceStore.getState().burnPhase).toBe(phase)
    }
  })

  it('setFlashing() flips the flag', () => {
    useDeviceStore.getState().setFlashing(true)
    expect(useDeviceStore.getState().flashing).toBe(true)

    useDeviceStore.getState().setFlashing(false)
    expect(useDeviceStore.getState().flashing).toBe(false)
  })
})
