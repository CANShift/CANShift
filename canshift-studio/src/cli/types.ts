// src/cli/types.ts — Shared types for the CLI runtime

import type { LogLevel } from '../stores/log.store'

/**
 * Subset of xterm `Terminal` we depend on inside command handlers. Keeping the
 * surface narrow means tests can mock this without pulling xterm in.
 */
export interface CliTerminalHandle {
  write: (data: string) => void
  writeln: (data: string) => void
  clear: () => void
}

/**
 * Snapshot of the runtime state a command can read or mutate. This is built
 * once per dispatch from the relevant Zustand stores so the command logic
 * stays a pure function of its inputs.
 */
export interface CommandContext {
  /** Current studio version (`appIpc.version()` cached). */
  appVersion: string
  /** Connected device snapshot. `firmwareVersion` is null until first probe. */
  device: {
    connected: boolean
    portPath: string | null
    firmwareVersion: string | null
    /** SD card runtime state from `useDeviceStore`. */
    sdState: 'unknown' | 'ok' | 'no_card' | 'mount_failed'
  }
  /** Loaded dashboard config (used for the prompt host slug). */
  config: { name: string } | null
  /** Push to the studio log store. */
  log: (level: LogLevel, message: string, scope?: string) => void
  /** xterm instance for direct output. */
  terminal: CliTerminalHandle
  /** All commands registered in the CLI — `help` reads this. */
  commands: readonly CommandSpec[]
}

/**
 * Result of a command invocation. `ok: false` flips the prompt's trailing
 * `%` to red on the next line.
 */
export type CliResult = { ok: true } | { ok: false; reason?: string }

/**
 * Static description of a command. The registry is a discriminated union
 * keyed by `name`, so adding commands stays exhaustive at the call site.
 */
export interface CommandSpec {
  name: string
  /** Short one-liner shown by `help`. */
  summary: string
  /** Full usage string shown by `help <name>`. */
  usage: string
  run: (args: string[], ctx: CommandContext) => CliResult | Promise<CliResult>
}
