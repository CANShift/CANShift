// transport/__tests__/ws-client.test.ts — Round-trip coverage for the new
// device-config + input-bindings WS commands (#1077 follow-up).
//
// Mocks the `WsClient` singleton at the module boundary — every test case
// installs a `send` stub that returns the desired ack frame, then drives the
// IPC method and asserts on both the cmd byte + the parsed result. This keeps
// the suite hermetic (no real WebSocket) while still exercising the wire ↔
// domain mapping path that callers depend on.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AckResult } from '../ws-client'
import type { DeviceConfig, InputBindingsConfig } from '@tmbk/canshift-core'

type SendArgs = [number, Record<string, unknown>?]

const sendMock = vi.fn<(...args: SendArgs) => Promise<AckResult>>()

vi.mock('../ws-client', () => ({
  getWsClient: () => ({ send: sendMock }),
  __resetWsClientSingleton: () => undefined,
}))

const VALID_DEVICE_CONFIG: DeviceConfig = {
  canSpeedKbps: 500,
  twaiTxPin: 22,
  twaiRxPin: 21,
}

const VALID_DEVICE_WIRE = {
  can_speed_kbps: 500,
  twai_tx_pin: 22,
  twai_rx_pin: 21,
}

const VALID_INPUT_BINDINGS: InputBindingsConfig = {
  inputBindings: [
    {
      id: 'btn-a',
      pin: 13,
      active: 'low',
      pullup: true,
      debounceMs: 20,
      kind: 'short',
      action: { category: 'dashboard', type: 'navigate', pageId: 'p1' },
    },
  ],
}

const VALID_INPUT_BINDINGS_WIRE = {
  input_bindings: [
    {
      id: 'btn-a',
      pin: 13,
      active: 'low',
      pullup: true,
      debounce_ms: 20,
      kind: 'short',
      action: { category: 'dashboard', type: 'navigate', pageId: 'p1' },
    },
  ],
}

// Cmd byte values — kept in sync with `transport/index.ts`. Asserted on so a
// drift between the two surfaces fails the suite instead of the firmware.
const CMD_GET_DEVICE_CONFIG = 0x03
const CMD_PUT_DEVICE_CONFIG = 0x04
const CMD_GET_INPUT_BINDINGS = 0x0b
const CMD_PUT_INPUT_BINDINGS = 0x0c

beforeEach(() => {
  sendMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('deviceConfigIpc', () => {
  it('read() resolves to the parsed domain shape on a happy ack', async () => {
    sendMock.mockResolvedValueOnce({
      ok: true,
      data: { status: 'ok', device_config: VALID_DEVICE_WIRE },
    })

    const { deviceConfigIpc } = await import('../index')
    const result = await deviceConfigIpc.read()

    expect(sendMock).toHaveBeenCalledWith(CMD_GET_DEVICE_CONFIG)
    expect(result).toEqual({ success: true, config: VALID_DEVICE_CONFIG })
  })

  it('read() returns config:null when the firmware reports config_not_found', async () => {
    sendMock.mockResolvedValueOnce({ ok: false, error: 'config_not_found' })

    const { deviceConfigIpc } = await import('../index')
    const result = await deviceConfigIpc.read()

    expect(result).toEqual({ success: true, config: null })
  })

  it('read() surfaces a graceful error when the wire payload is malformed', async () => {
    sendMock.mockResolvedValueOnce({
      ok: true,
      data: { status: 'ok', device_config: { can_speed_kbps: 'fast' } },
    })

    const { deviceConfigIpc } = await import('../index')
    const result = await deviceConfigIpc.read()

    expect(result.success).toBe(false)
    expect(result.config).toBeNull()
    expect(result.error).toBe('invalid_device_config')
  })

  it('write() maps the domain shape to wire before sending', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, data: { status: 'ok' } })

    const { deviceConfigIpc } = await import('../index')
    const result = await deviceConfigIpc.write(VALID_DEVICE_CONFIG)

    expect(sendMock).toHaveBeenCalledWith(CMD_PUT_DEVICE_CONFIG, {
      device_config: VALID_DEVICE_WIRE,
    })
    expect(result).toEqual({ success: true })
  })

  it('write() surfaces a firmware error response untouched', async () => {
    sendMock.mockResolvedValueOnce({ ok: false, error: 'write_failed' })

    const { deviceConfigIpc } = await import('../index')
    const result = await deviceConfigIpc.write(VALID_DEVICE_CONFIG)

    expect(result).toEqual({ success: false, error: 'write_failed' })
  })

  it('write() rejects an invalid domain payload without hitting the wire', async () => {
    const { deviceConfigIpc } = await import('../index')
    const bad = { ...VALID_DEVICE_CONFIG, canSpeedKbps: -1 } as unknown as DeviceConfig
    const result = await deviceConfigIpc.write(bad)

    expect(sendMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'invalid_device_config' })
  })
})

describe('inputBindingsIpc', () => {
  it('read() resolves to the parsed domain shape on a happy ack', async () => {
    sendMock.mockResolvedValueOnce({
      ok: true,
      data: { status: 'ok', input_bindings: VALID_INPUT_BINDINGS_WIRE.input_bindings },
    })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.read()

    expect(sendMock).toHaveBeenCalledWith(CMD_GET_INPUT_BINDINGS)
    expect(result).toEqual({ success: true, config: VALID_INPUT_BINDINGS })
  })

  it('read() returns an empty list when the firmware reports config_not_found', async () => {
    sendMock.mockResolvedValueOnce({ ok: false, error: 'config_not_found' })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.read()

    expect(result).toEqual({ success: true, config: { inputBindings: [] } })
  })

  it('read() accepts the wrapping object shape for forward compatibility', async () => {
    sendMock.mockResolvedValueOnce({
      ok: true,
      data: { status: 'ok', input_bindings: VALID_INPUT_BINDINGS_WIRE },
    })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.read()

    expect(result).toEqual({ success: true, config: VALID_INPUT_BINDINGS })
  })

  it('read() surfaces a graceful error when the wire payload is malformed', async () => {
    sendMock.mockResolvedValueOnce({
      ok: true,
      data: { status: 'ok', input_bindings: [{ id: 'bad', pin: 'wrong' }] },
    })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.read()

    expect(result.success).toBe(false)
    expect(result.config).toBeNull()
    expect(result.error).toBe('invalid_input_bindings')
  })

  it('write() maps the domain shape to wire before sending', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, data: { status: 'ok' } })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.write(VALID_INPUT_BINDINGS)

    expect(sendMock).toHaveBeenCalledWith(CMD_PUT_INPUT_BINDINGS, VALID_INPUT_BINDINGS_WIRE)
    expect(result).toEqual({ success: true })
  })

  it('write() surfaces a firmware error response untouched', async () => {
    sendMock.mockResolvedValueOnce({ ok: false, error: 'pin_conflict' })

    const { inputBindingsIpc } = await import('../index')
    const result = await inputBindingsIpc.write(VALID_INPUT_BINDINGS)

    expect(result).toEqual({ success: false, error: 'pin_conflict' })
  })
})
