// src/cli/commands.ts — Initial CLI command registry.
//
// The full set lands in PR 2; this scaffold ships the four commands needed to
// validate the shell loop end-to-end:
//   • help     — list commands or show usage for one
//   • clear    — clear the xterm scrollback (does NOT touch the log store)
//   • version  — studio + firmware versions
//   • status   — current device snapshot

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
// Registry
// ---------------------------------------------------------------------------

export const COMMANDS: readonly CommandSpec[] = [HELP, CLEAR, VERSION, STATUS]

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
