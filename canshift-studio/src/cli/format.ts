// src/cli/format.ts — Format LogStore entries into ANSI-decorated CLI lines.

import type { LogEntry, LogLevel } from '../stores/log.store'

const ANSI_RESET = '\x1b[0m'
const ANSI_DIM_GREY = '\x1b[38;5;238m'
const ANSI_BRIGHT_BLACK = '\x1b[90m'
const ANSI_GREEN = '\x1b[32m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_RED = '\x1b[31m'
const ANSI_DEFAULT_FG = '\x1b[37m'

const SCOPE_PREFIX_RE = /^\[(\w[\w-]*)\]\s/

const LEVEL_COLOUR: Record<LogLevel, string> = {
  info: ANSI_BRIGHT_BLACK,
  warn: ANSI_YELLOW,
  error: ANSI_RED,
  success: ANSI_GREEN,
  debug: ANSI_BRIGHT_BLACK,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

interface ResolvedScope {
  scope: string | null
  message: string
}

/**
 * Pick a scope for the line: prefer the explicit `entry.scope`, else strip a
 * leading `[scope] ` prefix from the message so legacy 2-arg `push()` callers
 * still get scope colouring for free.
 */
function resolveScope(entry: LogEntry): ResolvedScope {
  if (entry.scope !== undefined) {
    return { scope: entry.scope, message: entry.message }
  }
  const match = SCOPE_PREFIX_RE.exec(entry.message)
  if (match !== null) {
    return { scope: match[1] ?? null, message: entry.message.slice(match[0].length) }
  }
  return { scope: null, message: entry.message }
}

/**
 * Render a LogEntry as a single ANSI-decorated line ending with `\r\n`.
 * Format: `HH:MM:SS  [scope]  message`.
 *
 * • Time → dim grey.
 * • Scope → level colour, only printed when present.
 * • Message → default fg, except `error` which renders entirely in red.
 */
export function formatLogEntry(entry: LogEntry): string {
  const { scope, message } = resolveScope(entry)
  const colour = LEVEL_COLOUR[entry.level]

  const parts: string[] = []
  parts.push(`${ANSI_DIM_GREY}${formatTime(entry.timestamp)}${ANSI_RESET}`)
  parts.push(' ')

  if (scope !== null) {
    parts.push(`${colour}[${scope}]${ANSI_RESET}`)
    parts.push('  ')
  } else {
    parts.push(' ')
  }

  if (entry.level === 'error') {
    parts.push(`${ANSI_RED}${message}${ANSI_RESET}`)
  } else {
    parts.push(`${ANSI_DEFAULT_FG}${message}${ANSI_RESET}`)
  }

  return `${parts.join('')}\r\n`
}
