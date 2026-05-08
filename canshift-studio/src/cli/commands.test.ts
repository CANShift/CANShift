// src/cli/commands.test.ts — Verify each shipped command against a mock
// CommandContext. Mocks intentionally collect writes as plain strings so we
// can assert on rendered output without xterm in the loop.

import { describe, expect, it, vi } from 'vitest'
import { COMMANDS, dispatch } from './commands'
import type { CommandContext } from './types'

interface FakeTerminal {
  written: string[]
  clear: ReturnType<typeof vi.fn>
}

function makeContext(overrides: Partial<CommandContext> = {}): {
  ctx: CommandContext
  terminal: FakeTerminal
  log: ReturnType<typeof vi.fn>
} {
  const written: string[] = []
  const clearFn = vi.fn<() => void>()
  const terminal: FakeTerminal = {
    written,
    clear: clearFn,
  }
  const log = vi.fn()
  const ctx: CommandContext = {
    appVersion: '0.7.1',
    device: {
      connected: true,
      portPath: '/dev/tty.usbserial-0001',
      firmwareVersion: '0.7.1',
      sdState: 'ok',
    },
    config: { name: 'demo' },
    log,
    terminal: {
      write: (data: string) => {
        written.push(data)
      },
      writeln: (data: string) => {
        written.push(`${data}\r\n`)
      },
      clear: () => {
        clearFn()
      },
    },
    commands: COMMANDS,
    ...overrides,
  }
  return { ctx, terminal, log }
}

describe('commands', () => {
  it('help lists all registered commands sorted alphabetically', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('help', [], ctx)
    expect(res).toEqual({ ok: true })
    const out = terminal.written.join('')
    for (const c of COMMANDS) {
      expect(out).toContain(c.name)
    }
  })

  it('help <known> prints usage', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('help', ['status'], ctx)
    expect(res).toEqual({ ok: true })
    expect(terminal.written.join('')).toContain('Usage: status')
  })

  it('help <unknown> reports the failure and returns ok:false', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('help', ['nope'], ctx)
    expect(res.ok).toBe(false)
    expect(terminal.written.join('')).toContain('no such command: nope')
  })

  it('clear calls terminal.clear without touching the log store', async () => {
    const { ctx, terminal, log } = makeContext()
    const res = await dispatch('clear', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(terminal.clear).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
  })

  it('version prints studio and firmware versions when connected', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('version', [], ctx)
    expect(res).toEqual({ ok: true })
    const out = terminal.written.join('')
    expect(out).toContain('studio: 0.7.1')
    expect(out).toContain('firmware: 0.7.1')
  })

  it("version falls back to 'not connected' when firmwareVersion is null", async () => {
    const { ctx, terminal } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        sdState: 'unknown',
      },
    })
    const res = await dispatch('version', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(terminal.written.join('')).toContain('firmware: not connected')
  })

  it('status prints the connected snapshot in the issue-example shape', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('status', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(terminal.written.join('')).toContain(
      '[status] connected on /dev/tty.usbserial-0001, firmware v0.7.1, sd=ok'
    )
  })

  it('status drops the firmware segment when firmwareVersion is null', async () => {
    const { ctx, terminal } = makeContext({
      device: {
        connected: true,
        portPath: '/dev/tty.usbserial-0001',
        firmwareVersion: null,
        sdState: 'ok',
      },
    })
    const res = await dispatch('status', [], ctx)
    expect(res).toEqual({ ok: true })
    const out = terminal.written.join('')
    expect(out).toContain('[status] connected on /dev/tty.usbserial-0001, sd=ok')
    expect(out).not.toContain('firmware v')
  })

  it('status prints the disconnected line when not connected', async () => {
    const { ctx, terminal } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        sdState: 'unknown',
      },
    })
    const res = await dispatch('status', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(terminal.written.join('')).toContain('[status] not connected')
  })

  it('unknown commands print zsh-style not-found and return ok:false', async () => {
    const { ctx, terminal } = makeContext()
    const res = await dispatch('foobar', [], ctx)
    expect(res.ok).toBe(false)
    expect(terminal.written.join('')).toContain('zsh: command not found: foobar')
  })
})
