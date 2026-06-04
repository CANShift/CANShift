// colors/hex.ts — Shared `#RRGGBB` regex + type-guard
//
// Three sites previously hand-rolled the same `/^#([0-9a-fA-F]{6})$/` pattern
// (sensor-defaults.ts, design-tokens.ts, migrations/migration-runner.ts). One
// canonical source removes drift risk — e.g. a future "accept 3-digit shortcut"
// rewrite must change exactly one file. Audit C-ME-4, umbrella #1016.
//
// `HexColor` (declared in `schemas/common.ts` as `z.infer<typeof HexColorSchema>`)
// is a Zod-branded `string`. This module deliberately re-uses the type via
// `import type` so the regex and the schema stay provably aligned.
//
// NOTE: the capture group around the 6 hex digits is preserved on purpose —
// `parseHex` callers in design-tokens.ts and sensor-defaults.ts rely on it.

import type { HexColor } from '../schemas/common.js'

/**
 * Strict `#RRGGBB` matcher with a capture group around the 6 hex digits.
 * Use this for parsing flows that need the hex payload (`HEX_REGEX.exec(s)?.[1]`).
 * For pure validation, prefer `isHexColor` — it carries the type-narrowing.
 */
export const HEX_REGEX = /^#([0-9a-fA-F]{6})$/

/**
 * Type-guard for `#RRGGBB`. Narrows to the branded `HexColor` type used by
 * `HexColorSchema` so call sites can drop the unsafe `as HexColor` cast.
 */
export function isHexColor(value: string): value is HexColor {
  return HEX_REGEX.test(value)
}
