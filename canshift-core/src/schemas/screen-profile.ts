// schemas/screen-profile.ts — Target screen profile catalog + Zod schema.
//
// A "screen profile" pairs a board's LCD with the logical canvas dimensions
// the studio editor renders into. Dashboards declare which profile they were
// authored for (`DashboardConfig.targetProfile`) so the editor preview, save-
// time bounds checks, and future firmware multi-board / multi-screen paths
// can all branch off the same identifier.
//
// v1 ships a single profile (`crowpanel-28` = 320×240 native). Adding new
// boards (issue #17) or larger panels (issue #18) extends the enum and the
// `SCREEN_PROFILES` table — no other schema bump is required because the
// field is optional on `DashboardConfig` and defaults to `crowpanel-28` for
// backward compatibility with every existing dashboard.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Identifier enum — single source of truth for known screen profiles
// ---------------------------------------------------------------------------

/**
 * Discriminant id for the target screen profile a dashboard was authored
 * against. Kebab-case literal so the value can be written verbatim in JSON
 * configs without escaping.
 */
export const ScreenProfileIdSchema = z.enum(['crowpanel-28'])

export type ScreenProfileId = z.infer<typeof ScreenProfileIdSchema>

// ---------------------------------------------------------------------------
// Profile shape
// ---------------------------------------------------------------------------

/**
 * Physical / logical canvas dimensions for a target screen profile. Today
 * only `id`, `name`, `width`, `height` are needed by studio-web to size the
 * canvas; future fields (dpi, touch, orientation, …) can be added without
 * a schema migration because consumers look up by `id` against the catalog
 * rather than reading dimensions out of `dashboard.json`.
 */
export const ScreenProfileSchema = z
  .object({
    id: ScreenProfileIdSchema,
    name: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()

export type ScreenProfile = z.infer<typeof ScreenProfileSchema>

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * Fallback / default profile id. Every dashboard authored before the
 * `targetProfile` field was added is treated as `crowpanel-28` (320×240) —
 * the only panel CANShift hardware ships with today.
 */
export const DEFAULT_SCREEN_PROFILE_ID: ScreenProfileId = 'crowpanel-28'

/**
 * Frozen catalog of supported screen profiles. Listed in display order for
 * pickers; do not sort alphabetically. Add new entries here as new boards
 * land (issue #17 / #18).
 */
export const SCREEN_PROFILES: readonly ScreenProfile[] = [
  { id: 'crowpanel-28', name: 'CrowPanel 2.8"', width: 320, height: 240 },
] as const

/**
 * Returns the profile entry for `id`. Today the enum is one-to-one with the
 * catalog, so this is a lookup; if a future enum extension forgets to add
 * a matching catalog row the runtime guard fires immediately rather than
 * silently returning `undefined`. The `string` widening on the lookup key
 * is deliberate — without it the type checker collapses the comparison to
 * a tautology and `no-unnecessary-condition` flags the guard.
 */
export function getScreenProfile(id: ScreenProfileId): ScreenProfile {
  const needle: string = id
  for (const profile of SCREEN_PROFILES) {
    if ((profile.id as string) === needle) return profile
  }
  throw new Error(`screen profile "${needle}" is not registered in SCREEN_PROFILES`)
}

/**
 * Resolves an optional `targetProfile` field (from `DashboardConfig`) to a
 * concrete profile, falling back to {@link DEFAULT_SCREEN_PROFILE_ID} when
 * the field is omitted. Studio's canvas and the firmware loader both go
 * through this helper to keep the default-resolution rule in one place.
 */
export function resolveScreenProfile(id: ScreenProfileId | undefined): ScreenProfile {
  return getScreenProfile(id ?? DEFAULT_SCREEN_PROFILE_ID)
}
