// src/cli/prompt.ts — Pure prompt builder for the studio CLI

const ANSI_GREEN = '\x1b[32m'
const ANSI_RED = '\x1b[31m'
const ANSI_RESET = '\x1b[0m'

const HOST_DISCONNECTED = '(disconnected)'
const HOST_UNNAMED = '(unnamed)'
const HOST_MAX_LEN = 32
const SLUG_INVALID = /[^A-Za-z0-9._-]+/g

export interface PromptInput {
  connected: boolean
  configName: string | null | undefined
  /** Whether the previous command exited successfully — drives the `%` colour. */
  lastExitOk: boolean
}

/**
 * Slugify a dashboard name into a shell-friendly host token:
 *   • allowed characters: `[A-Za-z0-9._-]`
 *   • runs of disallowed characters collapse to a single `-`
 *   • trim leading/trailing `-`
 *   • lowercase, capped at 32 chars
 *
 * Empty or whitespace-only names yield an empty string — the caller falls
 * back to `(unnamed)` in that case.
 */
export function slugifyHost(rawName: string): string {
  return rawName
    .replace(SLUG_INVALID, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, HOST_MAX_LEN)
}

function resolveHost(input: PromptInput): string {
  if (!input.connected) return HOST_DISCONNECTED
  const name = input.configName?.trim() ?? ''
  if (name.length === 0) return HOST_UNNAMED
  const slug = slugifyHost(name)
  return slug.length > 0 ? slug : HOST_UNNAMED
}

/**
 * Build the next prompt line. Format:
 *
 *     canshift@<host> ~ %_
 *
 * The leading `canshift@<host>` is green, the ` ~ ` separator is the
 * default colour, and the trailing `%` is red when `lastExitOk` is `false`.
 * All sequences are reset before the trailing space.
 */
export function buildPrompt(input: PromptInput): string {
  const host = resolveHost(input)
  const exitColour = input.lastExitOk ? '' : ANSI_RED
  const exitReset = input.lastExitOk ? '' : ANSI_RESET
  return `${ANSI_GREEN}canshift@${host}${ANSI_RESET} ~ ${exitColour}%${exitReset} `
}
