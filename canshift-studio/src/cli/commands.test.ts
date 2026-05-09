// src/cli/commands.test.ts — Verify each shipped command against a mock
// CommandContext. Mocks intentionally collect writes as plain strings so we
// can assert on rendered output without xterm in the loop.

import { describe, expect, it, vi } from 'vitest'
import { COMMANDS, complete, dispatch, longestCommonPrefix } from './commands'
import type { CliActions, CommandContext } from './types'

interface FakeTerminal {
  written: string[]
  clear: ReturnType<typeof vi.fn>
}

const okResult = { ok: true } as const

function makeActions(overrides: Partial<CliActions> = {}): CliActions {
  return {
    burnConfig: vi.fn(() => Promise.resolve(okResult)),
    connect: vi.fn(() => Promise.resolve(okResult)),
    disconnect: vi.fn(() => Promise.resolve(okResult)),
    reboot: vi.fn(() => Promise.resolve(okResult)),
    openFlashRoute: vi.fn(() => okResult),
    listPorts: vi.fn(() => Promise.resolve<string[]>([])),
    ...overrides,
  }
}

function makeContext(overrides: Partial<CommandContext> = {}): {
  ctx: CommandContext
  terminal: FakeTerminal
  log: ReturnType<typeof vi.fn>
  actions: CliActions
} {
  const written: string[] = []
  const clearFn = vi.fn<() => void>()
  const terminal: FakeTerminal = {
    written,
    clear: clearFn,
  }
  const log = vi.fn()
  const actions = overrides.actions ?? makeActions()
  const ctx: CommandContext = {
    appVersion: '0.7.1',
    device: {
      connected: true,
      portPath: '/dev/tty.usbserial-0001',
      firmwareVersion: '0.7.1',
      simulationMode: false,
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
    actions,
    ...overrides,
  }
  return { ctx, terminal, log, actions }
}

describe('commands — informational', () => {
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
        simulationMode: false,
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
      '[status] connected on /dev/tty.usbserial-0001, firmware v0.7.1'
    )
  })

  it('status drops the firmware segment when firmwareVersion is null', async () => {
    const { ctx, terminal } = makeContext({
      device: {
        connected: true,
        portPath: '/dev/tty.usbserial-0001',
        firmwareVersion: null,
        simulationMode: false,
      },
    })
    const res = await dispatch('status', [], ctx)
    expect(res).toEqual({ ok: true })
    const out = terminal.written.join('')
    expect(out).toContain('[status] connected on /dev/tty.usbserial-0001')
    expect(out).not.toContain('firmware v')
  })

  it('status prints the disconnected line when not connected', async () => {
    const { ctx, terminal } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
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

describe('commands — device actions', () => {
  it('burn refuses without a loaded config', async () => {
    const actions = makeActions()
    const { ctx, terminal } = makeContext({ config: null, actions })
    const res = await dispatch('burn', [], ctx)
    expect(res.ok).toBe(false)
    expect(terminal.written.join('')).toContain('no config loaded')
    expect(actions.burnConfig).not.toHaveBeenCalled()
  })

  it('burn refuses when not connected', async () => {
    const actions = makeActions()
    const { ctx, terminal } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
      },
      actions,
    })
    const res = await dispatch('burn', [], ctx)
    expect(res.ok).toBe(false)
    expect(terminal.written.join('')).toContain('not connected')
    expect(actions.burnConfig).not.toHaveBeenCalled()
  })

  it('burn forwards to actions.burnConfig and propagates result', async () => {
    const actions = makeActions({
      burnConfig: vi.fn(() => Promise.resolve({ ok: false, reason: 'connection lost' } as const)),
    })
    const { ctx } = makeContext({ actions })
    const res = await dispatch('burn', [], ctx)
    expect(res).toEqual({ ok: false, reason: 'connection lost' })
    expect(actions.burnConfig).toHaveBeenCalledTimes(1)
  })

  it('connect refuses when already connected', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({ actions })
    const res = await dispatch('connect', [], ctx)
    expect(res.ok).toBe(false)
    expect(actions.connect).not.toHaveBeenCalled()
  })

  it('connect with explicit port forwards the argument', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
      },
      actions,
    })
    const res = await dispatch('connect', ['/dev/tty.usb'], ctx)
    expect(res).toEqual({ ok: true })
    expect(actions.connect).toHaveBeenCalledWith('/dev/tty.usb')
  })

  it('connect with no args forwards undefined for auto-pick', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
      },
      actions,
    })
    await dispatch('connect', [], ctx)
    expect(actions.connect).toHaveBeenCalledWith(undefined)
  })

  it('disconnect refuses when not connected', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
      },
      actions,
    })
    const res = await dispatch('disconnect', [], ctx)
    expect(res.ok).toBe(false)
    expect(actions.disconnect).not.toHaveBeenCalled()
  })

  it('disconnect forwards to actions.disconnect', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({ actions })
    const res = await dispatch('disconnect', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(actions.disconnect).toHaveBeenCalledTimes(1)
  })

  it('reboot refuses when not connected', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({
      device: {
        connected: false,
        portPath: null,
        firmwareVersion: null,
        simulationMode: false,
      },
      actions,
    })
    const res = await dispatch('reboot', [], ctx)
    expect(res.ok).toBe(false)
    expect(actions.reboot).not.toHaveBeenCalled()
  })

  it('flash navigates to the firmware update route', async () => {
    const actions = makeActions()
    const { ctx } = makeContext({ actions })
    const res = await dispatch('flash', [], ctx)
    expect(res).toEqual({ ok: true })
    expect(actions.openFlashRoute).toHaveBeenCalledTimes(1)
  })
})

describe('complete', () => {
  it('returns matching command names on first token', async () => {
    const { ctx } = makeContext()
    const out = await complete(['c'], false, ctx)
    expect(out).toContain('clear')
    expect(out).toContain('connect')
    expect(out).not.toContain('help')
  })

  it('returns all command names for an empty line', async () => {
    const { ctx } = makeContext()
    const out = await complete([], false, ctx)
    expect(out).toEqual(COMMANDS.map((c) => c.name))
  })

  it('returns the help-completer arg list when typing help <prefix>', async () => {
    const { ctx } = makeContext()
    const out = await complete(['help', 's'], false, ctx)
    expect(out).toContain('status')
    expect(out).not.toContain('clear')
  })

  it('returns connect-completer values for connect <port>', async () => {
    const actions = makeActions({
      listPorts: vi.fn(() => Promise.resolve(['/dev/tty.usbserial-110', '/dev/tty.usbmodem'])),
    })
    const { ctx } = makeContext({ actions })
    const out = await complete(['connect', '/dev/tty.usbs'], false, ctx)
    expect(out).toContain('/dev/tty.usbserial-110')
  })
})

describe('longestCommonPrefix', () => {
  it('returns empty string for an empty list', () => {
    expect(longestCommonPrefix([])).toBe('')
  })

  it('returns the only element for a singleton', () => {
    expect(longestCommonPrefix(['help'])).toBe('help')
  })

  it('returns the common prefix when all share one', () => {
    expect(longestCommonPrefix(['connect', 'config'])).toBe('con')
  })

  it('returns empty when the first chars differ', () => {
    expect(longestCommonPrefix(['burn', 'flash'])).toBe('')
  })
})
