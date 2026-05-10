// releases.types.ts — Shared shape for the GitHub release info card.
//
// Mirrors `@tmbk/canshift-core/src/types/releases.ts` so the mobile side of
// issue #571 surfaces the same payload as the studio side (PR #597). Mobile
// does not depend on `@tmbk/canshift-core` today; keeping a local copy here
// avoids pulling in the workspace's ESM build pipeline for a single type.
// When mobile starts consuming `canshift-core` for other types, drop this
// file and re-export from there instead.

/** A downloadable file attached to a GitHub release (installer, firmware, etc.). */
export interface ReleaseAsset {
  /** Original asset filename as published on GitHub. */
  name: string
  /** Full public URL to the asset (browser_download_url from the API). */
  downloadUrl: string
  /** Asset size in bytes (from GitHub `assets[].size`). */
  sizeBytes: number
  /** Asset MIME type as reported by GitHub, when present. */
  contentType?: string
}

/** Lean view of a GitHub release surfaced to the studio/mobile UI. */
export interface ReleaseInfo {
  /** Tag without the leading `v` (e.g. `0.8.3`). */
  version: string
  /** Full tag name (e.g. `v0.8.3`). */
  tag: string
  /** Human-friendly release name when GitHub provides one, otherwise `null`. */
  name: string | null
  /** Raw markdown body of the release; empty string when none was published. */
  notes: string
  /** ISO-8601 timestamp at which the release was published. */
  publishedAt: string
  /** True when the release is flagged as `prerelease` on GitHub. */
  prerelease: boolean
  /** Direct link to the GitHub release page. */
  htmlUrl: string
  /** Downloadable assets attached to the release. */
  assets: ReleaseAsset[]
}

/**
 * Discriminated outcome of fetching the latest release. The UI narrows on
 * `ok` to decide whether to render the card or the error state. `reason`
 * surfaces the broad failure class so the UI can phrase the message without
 * leaking transport details.
 */
export type LatestReleaseResult =
  | {
      ok: true
      release: ReleaseInfo
      /** Latest pre-release alongside the stable one — `null` when none exists. */
      prerelease: ReleaseInfo | null
      fetchedAt: string
      /** True when the payload came from the in-memory cache, not a live fetch. */
      fromCache: boolean
    }
  | {
      ok: false
      reason: 'offline' | 'rate-limited' | 'http-error' | 'invalid-response'
      /** Short human-readable hint; never includes secrets or stack traces. */
      message: string
      fetchedAt: string
      /** When the last cached payload exists, the UI can still show it. */
      cached: {
        release: ReleaseInfo
        prerelease: ReleaseInfo | null
        fetchedAt: string
      } | null
    }
