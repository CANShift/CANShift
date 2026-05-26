// schemas/font-family.ts — Dashboard font-family catalog + Zod schema.
//
// A "font family" identifies the typeface bundle the firmware loads from
// SPIFFS at boot to render every dashboard text element (gauge numbers,
// labels, top-bar text). Dashboards declare their preferred family via
// `DashboardConfig.fontFamily` so the studio preview and the firmware
// loader branch off the same identifier (issues #971 + #500).
//
// v1 ships a single family (`orbitron`) so the field is effectively a
// seat for the future selector — adding new bundles (Rajdhani, Exo 2,
// JetBrains Mono, …) extends the enum and the `FONT_FAMILIES` table
// without a schema migration because the field is optional on
// `DashboardConfig` and defaults to `orbitron` for every config that
// predates this addition.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Identifier enum — single source of truth for known font families
// ---------------------------------------------------------------------------

/**
 * Discriminant id for the dashboard font family. Lower-case literal so the
 * value can be written verbatim in JSON configs without escaping and stays
 * readable when embedded in a SPIFFS path (`/fonts/<id>/orbitron_black_32.bin`).
 */
export const FontFamilyIdSchema = z.enum(['orbitron'])

export type FontFamilyId = z.infer<typeof FontFamilyIdSchema>

// ---------------------------------------------------------------------------
// Catalog entry shape
// ---------------------------------------------------------------------------

/**
 * Catalog metadata for a font family. The studio picker reads `displayName`
 * and `description` to render the dropdown row; the firmware loader and the
 * SPIFFS provisioner only need the `id` (everything else lives in flash).
 *
 * Future fields (license, source URL, weight glyph coverage, sample text)
 * can be added without a schema migration because consumers look entries up
 * by `id` rather than embedding the metadata in `dashboard.json`.
 */
export interface FontFamilyEntry {
  readonly id: FontFamilyId
  readonly displayName: string
  readonly description: string
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * Fallback / default family id. Every dashboard authored before the
 * `fontFamily` field was added is treated as `orbitron` — the only family
 * the firmware bundles today. Mirrors the
 * {@link DEFAULT_SCREEN_PROFILE_ID} resolution pattern (#548).
 */
export const DEFAULT_FONT_FAMILY_ID: FontFamilyId = 'orbitron'

/**
 * Frozen catalog of supported font families. Listed in display order for
 * the studio picker; do not sort alphabetically. Add new entries here when
 * the firmware-side font loader lands the matching SPIFFS bundle (#971).
 */
export const FONT_FAMILIES: readonly FontFamilyEntry[] = [
  {
    id: 'orbitron',
    displayName: 'Orbitron',
    description: 'Default — futuristic display sans bundled with the firmware',
  },
] as const

/**
 * Returns the catalog entry for `id`. The enum is one-to-one with the
 * catalog today; the runtime guard fires if a future enum extension
 * forgets to add a matching row. The `string` widening on the lookup
 * key is deliberate — without it the type checker collapses the
 * comparison to a tautology and `no-unnecessary-condition` flags the
 * guard.
 */
export function getFontFamily(id: FontFamilyId): FontFamilyEntry {
  const needle: string = id
  for (const entry of FONT_FAMILIES) {
    if ((entry.id as string) === needle) return entry
  }
  throw new Error(`font family "${needle}" is not registered in FONT_FAMILIES`)
}

/**
 * Resolves an optional `fontFamily` field (from `DashboardConfig`) to a
 * concrete catalog entry, falling back to {@link DEFAULT_FONT_FAMILY_ID}
 * when the field is omitted. Studio's preview and the firmware loader
 * both go through this helper to keep the default-resolution rule in one
 * place.
 */
export function resolveFontFamily(id: FontFamilyId | undefined): FontFamilyEntry {
  return getFontFamily(id ?? DEFAULT_FONT_FAMILY_ID)
}
