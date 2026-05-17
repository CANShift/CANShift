// zod-error-map.ts — Friendly Zod error formatting for the studio IPC layer.
//
// Issue #832. Two changes vs. raw Zod defaults:
//
//   1. A `friendlyZodErrorMap` rewrites the most common issue codes
//      (`invalid_type`, `invalid_enum_value`, `too_small`, `too_big`) into
//      plain English. Custom `.refine()` messages from canshift-core
//      schemas (e.g. "GPIO 6-11 are wired to the SPI flash chip — using
//      them as IO bricks the device") pass through unchanged — they're
//      already the right user-facing copy.
//
//   2. `summarizeZodError` builds a one-line, action-oriented summary
//      suitable for surfacing in a toast / inline error label. The full
//      `issues[]` array still ships over IPC for any consumer that wants
//      to render every issue individually.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Path → label dictionary for top-level config fields. Keep entries here when
// the raw key isn't already a user-friendly word. Nested paths fall back to
// `formatPathFallback` below.
// ---------------------------------------------------------------------------

const PATH_LABELS: Record<string, string> = {
  canSpeedKbps: 'CAN bus speed',
  twaiTxPin: 'TWAI TX pin',
  twaiRxPin: 'TWAI RX pin',
  inputBindings: 'physical button bindings',
  debounceMs: 'debounce',
  stepKmh: 'cruise step (km/h)',
  pageId: 'target page',
  mapIndex: 'map index',
  frameId: 'CAN frame ID',
  pages: 'page list',
  widgets: 'widget list',
  topBar: 'top bar',
  revLimitRpm: 'rev limit',
  defaultPageId: 'default page',
}

function formatPathFallback(path: (string | number)[]): string {
  if (path.length === 0) return 'config'
  return path
    .map((seg) => {
      if (typeof seg === 'number') return `#${String(seg + 1)}`
      return PATH_LABELS[seg] ?? seg
    })
    .join(' → ')
}

// ---------------------------------------------------------------------------
// Error map — rewrites Zod's default messages for the codes we hit most often.
// Custom `.refine()` callers in canshift-core supply their own message via
// `issue.message`, which Zod still prefers over `ctx.defaultError` — we only
// touch the cases where Zod itself synthesized the message.
// ---------------------------------------------------------------------------

export const friendlyZodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: 'required field is missing' }
      }
      return {
        message: `expected ${issue.expected}, got ${issue.received}`,
      }

    case z.ZodIssueCode.invalid_enum_value:
      return {
        message: `must be one of: ${issue.options.map(String).join(', ')}`,
      }

    case z.ZodIssueCode.too_small: {
      const min = String(issue.minimum)
      if (issue.type === 'string') return { message: `must be at least ${min} characters` }
      if (issue.type === 'array') return { message: `needs at least ${min} entries` }
      return { message: `must be ≥ ${min}` }
    }

    case z.ZodIssueCode.too_big: {
      const max = String(issue.maximum)
      if (issue.type === 'string') return { message: `must be at most ${max} characters` }
      if (issue.type === 'array') return { message: `cannot exceed ${max} entries` }
      return { message: `must be ≤ ${max}` }
    }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'regex') return { message: 'has an invalid format' }
      return { message: ctx.defaultError }

    case z.ZodIssueCode.unrecognized_keys:
      return {
        message: `unknown field${issue.keys.length === 1 ? '' : 's'}: ${issue.keys.join(', ')}`,
      }

    default:
      return { message: ctx.defaultError }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Install the friendly error map as the default. Call once at module load
 * (idempotent — Zod just replaces the previous map). All `safeParse` calls
 * in the main process after this benefit from the friendlier defaults.
 */
export function installFriendlyZodErrorMap(): void {
  z.setErrorMap(friendlyZodErrorMap)
}

/**
 * Structured-per-issue view. Each entry pairs the original Zod path with the
 * user-facing label so a renderer can show field-name + reason. The legacy
 * flat-string `formatZodIssues` is still exported for log lines and CLI
 * surfaces that want a single line per issue.
 */
export interface FriendlyZodIssue {
  /** Dot-joined raw path (e.g. `dashboard.pages.0.widgets.2.position.x`). */
  path: string
  /** User-facing label, derived from PATH_LABELS + array indices. */
  label: string
  /** The (post-error-map) message. */
  message: string
}

export function friendlyZodIssues(error: z.ZodError): FriendlyZodIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    label: formatPathFallback(issue.path),
    message: issue.message,
  }))
}

/**
 * One-line summary suitable for the `error` field of an IPC result object.
 * Picks the first issue (Zod orders them deterministically by path) and
 * formats it as `<label>: <message>`. When there are multiple issues, a
 * suffix is appended so the user knows there's more to inspect.
 */
export function summarizeZodError(error: z.ZodError): string {
  const issues = friendlyZodIssues(error)
  const head = issues[0]
  if (head === undefined) return 'validation failed'
  const base = head.path === '' ? head.message : `${head.label}: ${head.message}`
  if (issues.length === 1) return base
  return `${base} (+${String(issues.length - 1)} more)`
}
