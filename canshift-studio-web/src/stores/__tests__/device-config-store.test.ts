// stores/__tests__/device-config-store.test.ts — Coverage for the
// deviceConfig + inputBindings stores' load/save lifecycle (#1077 follow-up).
//
// Both stores own an editable draft plus a thin IPC adapter; the existing
// `ws-client.test.ts` covers the IPC layer in isolation but the stores
// themselves were untested. We mock `../transport` at the module boundary
// so each case drives a deterministic IPC outcome and asserts on the
// resulting (config, loaded, saveStatus, saveError) tuple.
//
// Concerns:
//   - load() is idempotent — a second call after success doesn't re-IPC
//   - load() flips `loaded=true` even when IPC errors out (so the route
//     stops spinning)
//   - save() transitions saving → saved on a happy ack
//   - save() transitions saving → error on a firmware refusal, surfaces
//     the error message
//   - save() catches thrown errors and surfaces their message
//   - clearSaveStatus resets back to idle

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DeviceConfig, InputBinding, InputBindingsConfig } from '@tmbk/canshift-core'

interface FakeIpc {
  readResult:
    | { success: true; config: DeviceConfig | null }
    | { success: false; config: null; error: string }
    | (() => Promise<unknown>)
  writeResult: { success: boolean; error?: string } | (() => Promise<unknown>)
  readCalls: number
  writeCalls: Array<unknown>
}

interface FakeBindingsIpc {
  readResult:
    | { success: true; config: InputBindingsConfig | null }
    | { success: false; config: null; error: string }
    | (() => Promise<unknown>)
  writeResult: { success: boolean; error?: string } | (() => Promise<unknown>)
  readCalls: number
  writeCalls: Array<unknown>
}

const fakeDevice: FakeIpc = {
  readResult: { success: true, config: null },
  writeResult: { success: true },
  readCalls: 0,
  writeCalls: [],
}

const fakeBindings: FakeBindingsIpc = {
  readResult: { success: true, config: { inputBindings: [] } },
  writeResult: { success: true },
  readCalls: 0,
  writeCalls: [],
}

vi.mock('../../transport', () => ({
  deviceConfigIpc: {
    read: async () => {
      fakeDevice.readCalls += 1
      const r = fakeDevice.readResult
      return typeof r === 'function' ? r() : r
    },
    write: async (cfg: DeviceConfig) => {
      fakeDevice.writeCalls.push(cfg)
      const r = fakeDevice.writeResult
      return typeof r === 'function' ? r() : r
    },
  },
  inputBindingsIpc: {
    read: async () => {
      fakeBindings.readCalls += 1
      const r = fakeBindings.readResult
      return typeof r === 'function' ? r() : r
    },
    write: async (cfg: InputBindingsConfig) => {
      fakeBindings.writeCalls.push(cfg)
      const r = fakeBindings.writeResult
      return typeof r === 'function' ? r() : r
    },
  },
}))

const STUB_DEVICE: DeviceConfig = {
  canSpeedKbps: 500,
  twaiTxPin: 22,
  twaiRxPin: 21,
}

const STUB_BINDING: InputBinding = {
  id: 'btn-a',
  pin: 13,
  active: 'low',
  pullup: true,
  debounceMs: 20,
  kind: 'short',
  action: { category: 'dashboard', type: 'navigate', pageId: 'p1' },
} as unknown as InputBinding

beforeEach(() => {
  fakeDevice.readResult = { success: true, config: null }
  fakeDevice.writeResult = { success: true }
  fakeDevice.readCalls = 0
  fakeDevice.writeCalls = []
  fakeBindings.readResult = { success: true, config: { inputBindings: [] } }
  fakeBindings.writeResult = { success: true }
  fakeBindings.readCalls = 0
  fakeBindings.writeCalls = []
  vi.resetModules()
})

describe('deviceConfig.store — load lifecycle', () => {
  it('seeds the draft from a successful IPC read', async () => {
    fakeDevice.readResult = { success: true, config: STUB_DEVICE }
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().load()
    expect(useDeviceConfigStore.getState().config).toEqual(STUB_DEVICE)
    expect(useDeviceConfigStore.getState().loaded).toBe(true)
  })

  it('keeps the default draft when the device has no config', async () => {
    fakeDevice.readResult = { success: true, config: null }
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    const beforeDraft = useDeviceConfigStore.getState().config
    await useDeviceConfigStore.getState().load()
    expect(useDeviceConfigStore.getState().config).toEqual(beforeDraft)
    expect(useDeviceConfigStore.getState().loaded).toBe(true)
  })

  it('marks loaded=true even when IPC throws (best-effort fallback)', async () => {
    fakeDevice.readResult = () => Promise.reject(new Error('boom'))
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().load()
    expect(useDeviceConfigStore.getState().loaded).toBe(true)
  })

  it('load() is idempotent across the session', async () => {
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().load()
    await useDeviceConfigStore.getState().load()
    await useDeviceConfigStore.getState().load()
    expect(fakeDevice.readCalls).toBe(1)
  })
})

describe('deviceConfig.store — save lifecycle', () => {
  it('transitions saving → saved on a happy ack', async () => {
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    useDeviceConfigStore.getState().setConfig(STUB_DEVICE)

    const pending = useDeviceConfigStore.getState().save()
    expect(useDeviceConfigStore.getState().saveStatus).toBe('saving')
    await pending
    expect(useDeviceConfigStore.getState().saveStatus).toBe('saved')
    expect(useDeviceConfigStore.getState().saveError).toBeNull()
    expect(fakeDevice.writeCalls[0]).toEqual(STUB_DEVICE)
  })

  it('transitions saving → error and surfaces the message on a firmware refusal', async () => {
    fakeDevice.writeResult = { success: false, error: 'pin_conflict' }
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().save()
    expect(useDeviceConfigStore.getState().saveStatus).toBe('error')
    expect(useDeviceConfigStore.getState().saveError).toBe('pin_conflict')
  })

  it('catches a thrown IPC error and surfaces its message', async () => {
    fakeDevice.writeResult = () => Promise.reject(new Error('socket gone'))
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().save()
    expect(useDeviceConfigStore.getState().saveStatus).toBe('error')
    expect(useDeviceConfigStore.getState().saveError).toBe('socket gone')
  })

  it('clearSaveStatus drops the transient state back to idle', async () => {
    fakeDevice.writeResult = { success: false, error: 'whatever' }
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    await useDeviceConfigStore.getState().save()
    useDeviceConfigStore.getState().clearSaveStatus()
    expect(useDeviceConfigStore.getState().saveStatus).toBe('idle')
    expect(useDeviceConfigStore.getState().saveError).toBeNull()
  })

  it('updateConfig merges a patch into the draft without IPC', async () => {
    const { useDeviceConfigStore } = await import('../deviceConfig.store')
    useDeviceConfigStore.getState().setConfig(STUB_DEVICE)
    useDeviceConfigStore.getState().updateConfig({ canSpeedKbps: 250 })
    expect(useDeviceConfigStore.getState().config.canSpeedKbps).toBe(250)
    expect(useDeviceConfigStore.getState().config.twaiTxPin).toBe(STUB_DEVICE.twaiTxPin)
    expect(fakeDevice.writeCalls.length).toBe(0)
  })
})

describe('inputBindings.store — load lifecycle', () => {
  it('seeds the draft from a successful IPC read', async () => {
    fakeBindings.readResult = {
      success: true,
      config: { inputBindings: [STUB_BINDING] },
    }
    const { useInputBindingsStore } = await import('../inputBindings.store')
    await useInputBindingsStore.getState().load()
    expect(useInputBindingsStore.getState().bindings).toEqual([STUB_BINDING])
    expect(useInputBindingsStore.getState().loaded).toBe(true)
  })

  it('falls back to an empty draft when IPC throws', async () => {
    fakeBindings.readResult = () => Promise.reject(new Error('lost'))
    const { useInputBindingsStore } = await import('../inputBindings.store')
    await useInputBindingsStore.getState().load()
    expect(useInputBindingsStore.getState().loaded).toBe(true)
    expect(useInputBindingsStore.getState().bindings).toEqual([])
  })

  it('load() is idempotent across the session', async () => {
    const { useInputBindingsStore } = await import('../inputBindings.store')
    await useInputBindingsStore.getState().load()
    await useInputBindingsStore.getState().load()
    expect(fakeBindings.readCalls).toBe(1)
  })
})

describe('inputBindings.store — draft mutations', () => {
  it('addBinding / updateBinding / removeBinding all manipulate the local draft only', async () => {
    const { useInputBindingsStore } = await import('../inputBindings.store')
    useInputBindingsStore.getState().addBinding(STUB_BINDING)
    expect(useInputBindingsStore.getState().bindings.length).toBe(1)

    useInputBindingsStore.getState().updateBinding(0, { pin: 14 })
    expect(useInputBindingsStore.getState().bindings[0]?.pin).toBe(14)
    expect(useInputBindingsStore.getState().bindings[0]?.id).toBe('btn-a')

    useInputBindingsStore.getState().removeBinding(0)
    expect(useInputBindingsStore.getState().bindings).toEqual([])
    expect(fakeBindings.writeCalls.length).toBe(0)
  })

  it('save() sends the wrapped { inputBindings } shape and transitions to saved', async () => {
    const { useInputBindingsStore } = await import('../inputBindings.store')
    useInputBindingsStore.getState().setBindings([STUB_BINDING])
    await useInputBindingsStore.getState().save()
    expect(fakeBindings.writeCalls[0]).toEqual({ inputBindings: [STUB_BINDING] })
    expect(useInputBindingsStore.getState().saveStatus).toBe('saved')
  })

  it('save() surfaces the IPC error string', async () => {
    fakeBindings.writeResult = { success: false, error: 'pin_conflict' }
    const { useInputBindingsStore } = await import('../inputBindings.store')
    await useInputBindingsStore.getState().save()
    expect(useInputBindingsStore.getState().saveStatus).toBe('error')
    expect(useInputBindingsStore.getState().saveError).toBe('pin_conflict')
  })
})
