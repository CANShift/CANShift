import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'

import { DEFAULT_SIM_CONFIG } from '../../config/default-sim-config'
import { deviceIpc } from '../device-ipc'
import { getSerialClient } from '../webserial-client'

vi.mock('../webserial-client', () => ({
  getSerialClient: vi.fn(),
}))

const sendMock = vi.fn()

const respondWith = (response: {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
}): void => {
  sendMock.mockResolvedValue(response)
}

beforeEach(() => {
  sendMock.mockReset()
  vi.mocked(getSerialClient).mockReturnValue({ send: sendMock } as unknown as ReturnType<
    typeof getSerialClient
  >)
})

describe('deviceIpc.getConfig (#1703)', () => {
  it('passes a current-version valid config through unchanged', async () => {
    respondWith({ ok: true, data: { config: structuredClone(DEFAULT_SIM_CONFIG) } })

    const result = await deviceIpc.getConfig()

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.config.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.migrationsApplied).toEqual([])
    expect(result.config).toEqual(DEFAULT_SIM_CONFIG)
  })

  it('migrates an old-version config to the current schema', async () => {
    const oldConfig = { ...structuredClone(DEFAULT_SIM_CONFIG), version: '1.22.0' }
    respondWith({ ok: true, data: { config: oldConfig } })

    const result = await deviceIpc.getConfig()

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.config.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.migrationsApplied.length).toBeGreaterThan(0)
    expect(result.migrationsApplied[0]).toContain('1.22.0')
  })

  it('returns an error when the config has no usable version', async () => {
    respondWith({ ok: true, data: { config: { pages: [] } } })

    const result = await deviceIpc.getConfig()

    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.error).toContain('config_migration_failed')
  })

  it('returns an error when the migration chain cannot reach the current version', async () => {
    respondWith({ ok: true, data: { config: { version: '0.0.1' } } })

    const result = await deviceIpc.getConfig()

    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.error).toContain('config_migration_failed')
  })

  it('returns an error when a current-version config fails schema validation', async () => {
    respondWith({
      ok: true,
      data: { config: { version: CURRENT_SCHEMA_VERSION, pages: 'corrupt' } },
    })

    const result = await deviceIpc.getConfig()

    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.error).toContain('invalid_dashboard_config')
  })

  it('returns none when the device has no config', async () => {
    respondWith({ ok: false, error: 'config_not_found' })

    const result = await deviceIpc.getConfig()

    expect(result).toEqual({ kind: 'none' })
  })

  it('returns none when the response carries no config object', async () => {
    respondWith({ ok: true, data: {} })

    const result = await deviceIpc.getConfig()

    expect(result).toEqual({ kind: 'none' })
  })

  it('propagates transport errors', async () => {
    respondWith({ ok: false, error: 'ack_timeout' })

    const result = await deviceIpc.getConfig()

    expect(result).toEqual({ kind: 'error', error: 'ack_timeout' })
  })
})
