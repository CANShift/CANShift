// src/cli/commands.ts — CLI command registry.
//
// Each command is a `CommandSpec` that returns `CliResult` so the prompt's
// trailing `%` flips colour on failure. Side-effects (IPC, navigation) live
// behind `ctx.actions` — wired by `useCliRuntime` against the live stores —
// so handlers stay free of React imports and trivially unit-testable.

import type { CliResult, CommandContext, CommandSpec } from './types'

const NEWLINE = '\r\n'

function ok(): CliResult {
  return { ok: true }
}

function fail(reason?: string): CliResult {
  return reason !== undefined ? { ok: false, reason } : { ok: false }
}

function writeLine(ctx: CommandContext, text: string): void {
  ctx.terminal.write(`${text}${NEWLINE}`)
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------

const HELP: CommandSpec = {
  name: 'help',
  summary: 'List commands or show usage for one',
  usage: 'help [command]',
  run: (args, ctx) => {
    const target = args[0]
    if (target === undefined) {
      writeLine(ctx, 'Available commands:')
      const width = ctx.commands.reduce((max, c) => Math.max(max, c.name.length), 0)
      for (const c of [...ctx.commands].sort((a, b) => a.name.localeCompare(b.name))) {
        writeLine(ctx, `  ${c.name.padEnd(width)}  ${c.summary}`)
      }
      return ok()
    }
    const found = ctx.commands.find((c) => c.name === target)
    if (found === undefined) {
      writeLine(ctx, `help: no such command: ${target}`)
      return fail()
    }
    writeLine(ctx, `${found.name} — ${found.summary}`)
    writeLine(ctx, `Usage: ${found.usage}`)
    return ok()
  },
  complete: (args, ctx) => {
    if (args.length > 1) return []
    return ctx.commands.map((c) => c.name)
  },
}

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

const CLEAR: CommandSpec = {
  name: 'clear',
  summary: 'Clear the terminal scrollback',
  usage: 'clear',
  run: (_args, ctx) => {
    ctx.terminal.clear()
    return ok()
  },
}

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------

const VERSION: CommandSpec = {
  name: 'version',
  summary: 'Show studio and firmware versions',
  usage: 'version',
  run: (_args, ctx) => {
    writeLine(ctx, `studio: ${ctx.appVersion}`)
    const fw = ctx.device.firmwareVersion ?? 'not connected'
    writeLine(ctx, `firmware: ${fw}`)
    return ok()
  },
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

const STATUS: CommandSpec = {
  name: 'status',
  summary: 'Show device connection, firmware version, and SD state',
  usage: 'status',
  run: (_args, ctx) => {
    if (!ctx.device.connected) {
      writeLine(ctx, '[status] not connected')
      return ok()
    }
    const segments: string[] = []
    segments.push(`connected on ${ctx.device.portPath ?? 'unknown'}`)
    if (ctx.device.firmwareVersion !== null) {
      segments.push(`firmware v${ctx.device.firmwareVersion}`)
    }
    segments.push(`sd=${ctx.device.sdState}`)
    writeLine(ctx, `[status] ${segments.join(', ')}`)
    return ok()
  },
}

// ---------------------------------------------------------------------------
// burn
// ---------------------------------------------------------------------------

const BURN: CommandSpec = {
  name: 'burn',
  summary: 'Push the loaded config to the connected device',
  usage: 'burn',
  run: async (_args, ctx) => {
    if (ctx.config === null) {
      writeLine(ctx, '[burn] no config loaded — open or import one first')
      return fail()
    }
    if (!ctx.device.connected) {
      writeLine(ctx, '[burn] not connected')
      return fail()
    }
    return ctx.actions.burnConfig()
  },
}

// ---------------------------------------------------------------------------
// push-usb
// ---------------------------------------------------------------------------

const PUSH_USB: CommandSpec = {
  name: 'push-usb',
  summary: 'Push SD assets (signals, dashboards, fonts) to the device over USB',
  usage: 'push-usb',
  run: async (_args, ctx) => {
    if (!ctx.device.connected) {
      writeLine(ctx, '[push-usb] not connected')
      return fail()
    }
    return ctx.actions.pushUsb()
  },
}

// ---------------------------------------------------------------------------
// connect
// ---------------------------------------------------------------------------

const CONNECT: CommandSpec = {
  name: 'connect',
  summary: 'Connect to a serial port (auto-pick if omitted)',
  usage: 'connect [port]',
  run: async (args, ctx) => {
    if (ctx.device.connected) {
      writeLine(ctx, `[connect] already connected on ${ctx.device.portPath ?? 'unknown'}`)
      return fail()
    }
    return ctx.actions.connect(args[0])
  },
  complete: async (args, ctx) => {
    if (args.length > 1) return []
    try {
      return await ctx.actions.listPorts()
    } catch {
      return []
    }
  },
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

const DISCONNECT: CommandSpec = {
  name: 'disconnect',
  summary: 'Drop the active serial connection',
  usage: 'disconnect',
  run: async (_args, ctx) => {
    if (!ctx.device.connected) {
      writeLine(ctx, '[disconnect] not connected')
      return fail()
    }
    return ctx.actions.disconnect()
  },
}

// ---------------------------------------------------------------------------
// reboot
// ---------------------------------------------------------------------------

const REBOOT: CommandSpec = {
  name: 'reboot',
  summary: 'Reboot the connected device',
  usage: 'reboot',
  run: async (_args, ctx) => {
    if (!ctx.device.connected) {
      writeLine(ctx, '[reboot] not connected')
      return fail()
    }
    return ctx.actions.reboot()
  },
}

// ---------------------------------------------------------------------------
// flash
// ---------------------------------------------------------------------------

const FLASH: CommandSpec = {
  name: 'flash',
  summary: 'Open the firmware update panel',
  usage: 'flash',
  run: (_args, ctx) => {
    writeLine(
      ctx,
      '[flash] opening firmware update panel — pick a release and start the flash there'
    )
    return ctx.actions.openFlashRoute()
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COMMANDS: readonly CommandSpec[] = [
  HELP,
  CLEAR,
  VERSION,
  STATUS,
  BURN,
  PUSH_USB,
  CONNECT,
  DISCONNECT,
  REBOOT,
  FLASH,
]

/**
 * Resolve a command name and run it. Unknown commands print a zsh-style
 * "command not found" line and return `ok: false` so the prompt's `%`
 * turns red on the next line.
 */
export async function dispatch(
  name: string,
  args: string[],
  ctx: CommandContext
): Promise<CliResult> {
  const spec = ctx.commands.find((c) => c.name === name)
  if (spec === undefined) {
    ctx.terminal.write(`zsh: command not found: ${name}${NEWLINE}`)
    return fail()
  }
  return spec.run(args, ctx)
}

/**
 * Compute Tab-completion candidates for the partially typed line. Returns:
 *   • command names matching the prefix when the cursor is on the first token,
 *   • the active spec's `complete()` results (filtered by prefix) for arg
 *     positions if the spec defines one,
 *   • `[]` otherwise.
 */
export async function complete(
  tokens: readonly string[],
  trailingSpace: boolean,
  ctx: CommandContext
): Promise<string[]> {
  // Empty line or first-word prefix → suggest commands.
  if (tokens.length === 0 || (tokens.length === 1 && !trailingSpace)) {
    const prefix = tokens[0] ?? ''
    return ctx.commands.map((c) => c.name).filter((n) => n.startsWith(prefix))
  }

  const [name, ...restTokens] = tokens
  if (name === undefined) return []
  const spec = ctx.commands.find((c) => c.name === name)
  const completer = spec?.complete
  if (completer === undefined) return []

  // The arg the user is currently typing — empty string when a trailing
  // space pushed us onto a fresh slot.
  const argsForCompleter = trailingSpace ? [...restTokens, ''] : restTokens
  const partial = argsForCompleter[argsForCompleter.length - 1] ?? ''

  const candidates = await completer(argsForCompleter, ctx)
  return candidates.filter((c) => c.startsWith(partial))
}

/**
 * Compute the longest shared prefix of a non-empty list of strings.
 * Used to extend the input by the unambiguous portion of multiple matches.
 */
export function longestCommonPrefix(values: readonly string[]): string {
  if (values.length === 0) return ''
  let prefix = values[0] ?? ''
  for (let i = 1; i < values.length; i++) {
    const v = values[i] ?? ''
    let j = 0
    while (j < prefix.length && j < v.length && prefix[j] === v[j]) j++
    prefix = prefix.slice(0, j)
    if (prefix.length === 0) break
  }
  return prefix
}
