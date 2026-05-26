// stores/__tests__/connection-device.test.ts — Coverage for the
// connection.store ↔ device.store wiring (#1077 phase 3).
//
// `connection.store` listens to `WsClient.onStatus` and promotes the
// transitions into `device.store` (the editor surfaces read `connected`
// from there). We mock `getWsClient` at the module boundary so the test
// drives status events directly without spinning up a real socket. The
// status callback registered by the store is captured during the
// dynamic import — invoking it simulates the WsClient transitioning.
//
// Concerns covered:
// - connected → device.store.connected=true + transport='wifi' + host
// - disconnected → device.store.setDisconnected (when previously connected)
// - disconnected with error → device.store.errorMessage
// - host/port persistence to localStorage on setTarget / connect
// - disconnect proxies to the underlying client

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WsStatus } from '../../transport/ws-client'

// Module-scoped fake — recreated per test via beforeEach.
type StatusListener = (status: WsStatus, error?: string) => void

interface FakeClient {
  status: WsStatus
  statusListener: StatusListener | null
  connectCalls: Array<{ host: string | undefined; port: number | undefined }>
  disconnectCalls: number
}

const fake: FakeClient = {
  status: 'disconnected',
  statusListener: null,
  connectCalls: [],
  disconnectCalls: 0,
}

vi.mock('../../transport/ws-client', () => ({
  getWsClient: () => ({
    onStatus: (listener: StatusListener) => {
      fake.statusListener = listener
      return () => {
        fake.statusListener = null
      }
    },
    getStatus: () => fake.status,
    connect: async (host?: string, port?: number) => {
      fake.connectCalls.push({ host, port })
      // Don't auto-fire here — tests drive the listener directly.
    },
    disconnect: () => {
      fake.disconnectCalls += 1
    },
  }),
}))

// `localStorage` mock — the connection store reads + writes a host/port pair.
const storage: Record<string, string> = {}
beforeEach(() => {
  fake.status = 'disconnected'
  fake.statusListener = null
  fake.connectCalls = []
  fake.disconnectCalls = 0
  for (const k of Object.keys(storage)) delete storage[k]
  // Reset modules so the connection store re-registers its onStatus hook
  // against the fresh fake client between cases.
  vi.resetModules()

  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => {
      storage[k] = v
    },
    removeItem: (k: string) => {
      delete storage[k]
    },
    clear: () => {
      for (const k of Object.keys(storage)) delete storage[k]
    },
    key: () => null,
    length: 0,
  }
})

describe('connection.store — status mirroring', () => {
  it('promotes "connected" into the device store with transport=wifi and the host', async () => {
    storage['canshift:last-host'] = 'box.local'
    storage['canshift:last-port'] = '81'

    const { useConnectionStore } = await import('../connection.store')
    const { useDeviceStore } = await import('../device.store')

    // Mounting the store registers the listener.
    void useConnectionStore.getState()
    if (!fake.statusListener) throw new Error('listener not registered')

    fake.statusListener('connected', undefined)

    const dev = useDeviceStore.getState()
    expect(dev.connected).toBe(true)
    expect(dev.transport).toBe('wifi')
    expect(dev.wifiHost).toBe('box.local')

    const conn = useConnectionStore.getState()
    expect(conn.status).toBe('connected')
    expect(conn.lastError).toBeNull()
  })

  it('promotes "disconnected" with an error into device.store.errorMessage', async () => {
    const { useConnectionStore } = await import('../connection.store')
    const { useDeviceStore } = await import('../device.store')
    void useConnectionStore.getState()
    if (!fake.statusListener) throw new Error('listener not registered')

    // First arrive at connected, then drop with an error so setDisconnected
    // actually runs (the store guards on the previous `connected` flag).
    fake.statusListener('connected', undefined)
    expect(useDeviceStore.getState().connected).toBe(true)

    fake.statusListener('disconnected', 'single_client')
    const dev = useDeviceStore.getState()
    expect(dev.connected).toBe(false)
    expect(dev.errorMessage).toBe('single_client')

    expect(useConnectionStore.getState().status).toBe('disconnected')
    expect(useConnectionStore.getState().lastError).toBe('single_client')
  })

  it('intermediate states (connecting, reconnecting) leave device.store untouched', async () => {
    const { useConnectionStore } = await import('../connection.store')
    const { useDeviceStore } = await import('../device.store')
    void useConnectionStore.getState()
    if (!fake.statusListener) throw new Error('listener not registered')

    const before = useDeviceStore.getState().connected
    fake.statusListener('connecting', undefined)
    fake.statusListener('reconnecting', 'timeout')
    expect(useDeviceStore.getState().connected).toBe(before)

    // connection.store still tracks them for the UI banner.
    expect(useConnectionStore.getState().status).toBe('reconnecting')
    expect(useConnectionStore.getState().lastError).toBe('timeout')
  })
})

describe('connection.store — host/port persistence', () => {
  it('readStoredHost falls back to the default when storage is empty', async () => {
    const { useConnectionStore } = await import('../connection.store')
    expect(useConnectionStore.getState().host).toBe('canshift.local')
    expect(useConnectionStore.getState().port).toBe(81)
  })

  it('setTarget writes to localStorage and updates the store', async () => {
    const { useConnectionStore } = await import('../connection.store')
    useConnectionStore.getState().setTarget('192.168.4.1', 8181)
    expect(useConnectionStore.getState().host).toBe('192.168.4.1')
    expect(useConnectionStore.getState().port).toBe(8181)
    expect(storage['canshift:last-host']).toBe('192.168.4.1')
    expect(storage['canshift:last-port']).toBe('8181')
  })

  it('setTarget without an explicit port uses the default', async () => {
    const { useConnectionStore } = await import('../connection.store')
    useConnectionStore.getState().setTarget('foo.local')
    expect(useConnectionStore.getState().port).toBe(81)
    expect(storage['canshift:last-port']).toBe('81')
  })

  it('connect persists the target and forwards to the WsClient', async () => {
    const { useConnectionStore } = await import('../connection.store')
    await useConnectionStore.getState().connect('bar.local', 9000)

    expect(fake.connectCalls).toEqual([{ host: 'bar.local', port: 9000 }])
    expect(storage['canshift:last-host']).toBe('bar.local')
    expect(storage['canshift:last-port']).toBe('9000')
  })

  it('readStoredPort ignores garbage in localStorage and falls back to the default', async () => {
    storage['canshift:last-port'] = 'not-a-number'
    const { useConnectionStore } = await import('../connection.store')
    expect(useConnectionStore.getState().port).toBe(81)
  })

  it('disconnect proxies to the underlying client', async () => {
    const { useConnectionStore } = await import('../connection.store')
    useConnectionStore.getState().disconnect()
    expect(fake.disconnectCalls).toBe(1)
  })
})
