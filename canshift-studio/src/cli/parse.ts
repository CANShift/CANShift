// src/cli/parse.ts — Tokenize a CLI input line into command + raw args.
//
// Supports:
//   • whitespace-separated tokens
//   • double-quoted strings with `\"` escape and `\\` escape
//   • multi-line input — caller iterates over `parseMany`
//
// Single quotes are NOT special — kept as-is to match the zsh-like feel and
// avoid having to teach users that single and double behave differently in
// a non-shell context.

export interface ParsedCommand {
  name: string
  rawArgs: string[]
}

class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

/**
 * Tokenize one already-trimmed line (no `\n` allowed). Returns an empty array
 * for whitespace-only input. Throws `ParseError` on an unterminated quoted
 * segment.
 */
function tokenize(line: string): string[] {
  const tokens: string[] = []
  let buffer = ''
  let inQuotes = false
  let hasContent = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? ''

    if (inQuotes) {
      if (ch === '\\' && i + 1 < line.length) {
        const next = line[i + 1] ?? ''
        if (next === '"' || next === '\\') {
          buffer += next
          i++
          continue
        }
      }
      if (ch === '"') {
        inQuotes = false
        continue
      }
      buffer += ch
      hasContent = true
      continue
    }

    if (ch === '"') {
      inQuotes = true
      hasContent = true
      continue
    }

    if (ch === ' ' || ch === '\t') {
      if (hasContent) {
        tokens.push(buffer)
        buffer = ''
        hasContent = false
      }
      continue
    }

    buffer += ch
    hasContent = true
  }

  if (inQuotes) {
    throw new ParseError('Unterminated quoted string')
  }

  if (hasContent) {
    tokens.push(buffer)
  }

  return tokens
}

/**
 * Parse a single command line. Returns `null` for empty input.
 *
 * Multi-line input MUST be split by the caller via `parseMany`; passing a
 * raw `\n` here is treated as a single command (the newline collapses into
 * whitespace), which is rarely what you want.
 */
export function parse(line: string): ParsedCommand | null {
  const tokens = tokenize(line)
  if (tokens.length === 0) return null
  const [name, ...rawArgs] = tokens
  if (name === undefined) return null
  return { name, rawArgs }
}

/**
 * Split a (possibly multi-line) input on `\n` and return one parse result
 * per non-empty line.
 */
export function parseMany(input: string): ParsedCommand[] {
  const out: ParsedCommand[] = []
  for (const line of input.split('\n')) {
    const parsed = parse(line)
    if (parsed !== null) out.push(parsed)
  }
  return out
}

export { ParseError }
