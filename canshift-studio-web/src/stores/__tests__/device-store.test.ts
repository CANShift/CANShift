// stores/__tests__/device-store.test.ts — Coverage for the device store's
// lifecycle invariants (#1077 follow-up).
//
// device.store is the single source of truth for "are we wired to a live
// device" used by editor surfaces. Mistakes here cause stale-config diffs
// (audit S-L-6) and orphaned syncing spinners, so we lock down the
// transitions that have bitten production:
//
//   - setDisconnected clears `lastPushedConfig` so the next device's diff
//     dialog doesn't compare against the previous device's image (S-L-6)
//   - setDisconnected also clears firmwareCheck + firmwareCheckTick (so a
//     reconnect re-probes from scratch)
//   - clearError without a connected device transitions back to disconnected
//   - clearError with `connected: true` transitions to connected (was 'error')
//   - setSyncing toggles 'burning' / 'connected' / 'disconnected' depending
//     on the current `connected` flag
//   - manualDisconnect is persisted to sessionStorage and survives a fresh
//     store hydration (verified by direct sessionStorage assertion)

import { describe, it, expect, beforeEach } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'

const sessionStore: Record<string, string> = {}

beforeEach(() => {
  for (const k of Object.keys(sessionStore)) delete sessionStore[k]
  ;(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => sessionStore[k] ?? null,
    setItem: (k: string, v: string) => {
      sessionStore[k] = v
    },
    removeItem: (k: string) => {
      delete sessionStore[k]
    },
    clear: () => {
      for (const k of Object.keys(sessionStore)) delete sessionStore[k]
    },
    key: () => null,
    length: 0,
  }
})

async function freshStore() {
  const mod = await import('../device.store')
  // Reset to a known clean baseline — the store is a module singleton.
  mod.useDeviceStore.setState({
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
    manualDisconnect: false,
  })
  return mod
}

const stubConfig: DashboardConfig = {
  version: 'v1.3.0' as DashboardConfig['version'],
  name: 'stub',
  defaultPageId: 'p',
  topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
  pages: [],
} as unknown as DashboardConfig

describe('device.store — disconnect cleanup', () => {
  it('setDisconnected clears lastPushedConfig (audit S-L-6)', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnected('/dev/ttyUSB0')
    useDeviceStore.getState().setLastPushedConfig(stubConfig)
    expect(useDeviceStore.getState().lastPushedConfig).not.toBeNull()

    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().lastPushedConfig).toBeNull()
  })

  it('setDisconnected resets firmwareCheck to idle and tick to 0', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore
      .getState()
      .setFirmwareCheck({ kind: 'up_to_date', version: '1.0.0', checkedAt: 0 })
    useDeviceStore.getState().requestFirmwareRecheck()
    useDeviceStore.getState().requestFirmwareRecheck()
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(2)

    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().firmwareCheck).toEqual({ kind: 'idle' })
    expect(useDeviceStore.getState().firmwareCheckTick).toBe(0)
  })

  it('setDisconnected drops isDayMode back to unknown (null)', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setIsDayMode(true)
    expect(useDeviceStore.getState().isDayMode).toBe(true)
    useDeviceStore.getState().setDisconnected()
    expect(useDeviceStore.getState().isDayMode).toBeNull()
  })
})

describe('device.store — transport switching', () => {
  it('setConnectedWifi flips transport to wifi and stamps the host', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnectedWifi('canshift.local')
    const s = useDeviceStore.getState()
    expect(s.transport).toBe('wifi')
    expect(s.wifiHost).toBe('canshift.local')
    expect(s.portPath).toBeNull()
    expect(s.connected).toBe(true)
    expect(s.errorMessage).toBeNull()
  })

  it('setConnected flips transport to usb and clears wifiHost', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnectedWifi('h')
    useDeviceStore.getState().setConnected('/dev/ttyUSB0')
    const s = useDeviceStore.getState()
    expect(s.transport).toBe('usb')
    expect(s.portPath).toBe('/dev/ttyUSB0')
    expect(s.wifiHost).toBeNull()
  })
})

describe('device.store — syncing + error states', () => {
  it('setSyncing(true) while connected transitions status to burning', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnected('/dev/x')
    useDeviceStore.getState().setSyncing(true)
    expect(useDeviceStore.getState().status).toBe('burning')
    expect(useDeviceStore.getState().syncing).toBe(true)
  })

  it('setSyncing(false) while connected restores status to connected', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnected('/dev/x')
    useDeviceStore.getState().setSyncing(true)
    useDeviceStore.getState().setSyncing(false)
    expect(useDeviceStore.getState().status).toBe('connected')
    expect(useDeviceStore.getState().syncing).toBe(false)
  })

  it('setSyncing(false) while disconnected leaves status at disconnected', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setSyncing(true)
    expect(useDeviceStore.getState().status).toBe('burning')
    useDeviceStore.getState().setSyncing(false)
    expect(useDeviceStore.getState().status).toBe('disconnected')
  })

  it('clearError restores status to connected when still connected', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setConnected('/dev/x')
    useDeviceStore.getState().setError('boom')
    expect(useDeviceStore.getState().status).toBe('error')

    useDeviceStore.getState().clearError()
    expect(useDeviceStore.getState().status).toBe('connected')
    expect(useDeviceStore.getState().errorMessage).toBeNull()
  })

  it('clearError restores status to disconnected when not connected', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setError('boom')
    useDeviceStore.getState().clearError()
    expect(useDeviceStore.getState().status).toBe('disconnected')
  })
})

describe('device.store — manual disconnect persistence (sessionStorage)', () => {
  it('setManualDisconnect(true) writes the canshift:manual-disconnect flag', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setManualDisconnect(true)
    expect(sessionStore['canshift:manual-disconnect']).toBe('1')
    expect(useDeviceStore.getState().manualDisconnect).toBe(true)
  })

  it('setManualDisconnect(false) removes the flag from sessionStorage', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().setManualDisconnect(true)
    useDeviceStore.getState().setManualDisconnect(false)
    expect(sessionStore['canshift:manual-disconnect']).toBeUndefined()
    expect(useDeviceStore.getState().manualDisconnect).toBe(false)
  })
})

describe('device.store — simulation mode', () => {
  it('enterSimulation flips connected without a portPath / transport', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().enterSimulation()
    const s = useDeviceStore.getState()
    expect(s.simulationMode).toBe(true)
    expect(s.connected).toBe(true)
    expect(s.portPath).toBeNull()
    expect(s.transport).toBeNull()
  })

  it('exitSimulation drops connected and simulationMode', async () => {
    const { useDeviceStore } = await freshStore()
    useDeviceStore.getState().enterSimulation()
    useDeviceStore.getState().exitSimulation()
    const s = useDeviceStore.getState()
    expect(s.simulationMode).toBe(false)
    expect(s.connected).toBe(false)
  })
})
