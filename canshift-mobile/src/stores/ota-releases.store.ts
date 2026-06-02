// ota-releases.store.ts — Zustand store wrapping the firmware-release
// fetch (#905). Moves OtaService.fetchReleases() out of UpdateScreen's
// useEffect into a store action, matching the device/log/signals store
// pattern.
//
// Issue #1012 — the GitHub call is delegated to the shared ReleasesService
// (cache + retry + rate-limit + timeout) so the OTA picker no longer
// duplicates fetches with the About-screen path.
//
// State:
//   - releases: list returned by the last successful fetch, [] otherwise
//   - loading: true while the fetch is in-flight
//   - error: human-readable message from the last failed fetch, null otherwise

import { create } from 'zustand'
import type { ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'
import { RELEASE_MERGED_ASSET_SUFFIX, RELEASE_OTA_ASSET_SUFFIX } from '../constants/ota'
import type { FirmwareRelease } from '../services/ota.service'
import { releasesService } from '../services/releases.service'

/** SHA-256 expressed as `sha256:<64 lowercase hex chars>` — mirrors the
 *  regex previously in `ota.service.ts`. */
const SHA256_DIGEST_RE = /^sha256:([a-f0-9]{64})$/

function parseSha256Digest(digest: string | null | undefined): string | null {
  if (digest == null) return null
  const m = SHA256_DIGEST_RE.exec(digest)
  return m ? (m[1] ?? null) : null
}

/** Pick the firmware-partition asset (`*-firmware.bin`) from a release.
 *  Mirrors `pickOtaAsset` in `ota.service.ts`: skip the merged factory
 *  image and the SPIFFS image because pushing either through `Update.write`
 *  would brick the device. */
function pickOtaAsset(assets: ReleaseAsset[]): ReleaseAsset | null {
  return (
    assets.find(
      (a) =>
        a.name.endsWith(RELEASE_OTA_ASSET_SUFFIX) && !a.name.endsWith(RELEASE_MERGED_ASSET_SUFFIX)
    ) ?? null
  )
}

function toFirmwareRelease(r: ReleaseInfo): FirmwareRelease | null {
  const asset = pickOtaAsset(r.assets)
  if (!asset) return null
  return {
    version: r.version,
    publishedAt: r.publishedAt,
    notes: r.notes,
    downloadUrl: asset.downloadUrl,
    sizeBytes: asset.sizeBytes,
    sha256: parseSha256Digest(asset.digest),
  }
}

interface OtaReleasesState {
  releases: FirmwareRelease[]
  loading: boolean
  error: string | null
  /** Number of times `loadOtaReleases()` has been invoked since boot. */
  loadCount: number
}

const initial: OtaReleasesState = {
  releases: [],
  loading: false,
  error: null,
  loadCount: 0,
}

export const useOtaReleasesStore = create<OtaReleasesState>(() => initial)

/** In-flight load promise — null when no fetch is currently running. */
let inFlight: Promise<void> | null = null

/**
 * Fetch the firmware-release list. Concurrent calls during an in-flight
 * load are coalesced — the second caller awaits the same promise.
 */
export async function loadOtaReleases(): Promise<void> {
  if (inFlight) return inFlight

  useOtaReleasesStore.setState((s) => ({
    loading: true,
    error: null,
    loadCount: s.loadCount + 1,
  }))

  inFlight = (async () => {
    try {
      const result = await releasesService.getAllReleases()
      if (!result.ok) {
        useOtaReleasesStore.setState({ loading: false, error: result.message })
        return
      }
      // Map ReleaseInfo[] → FirmwareRelease[] and drop entries that have no
      // OTA-flashable asset (e.g. tooling-only releases, draft uploads). The
      // adapter mirrors the historical `OtaService.fetchReleases` semantics.
      const releases = result.releases
        .map(toFirmwareRelease)
        .filter((r): r is FirmwareRelease => r !== null)
      useOtaReleasesStore.setState({ releases, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load releases'
      useOtaReleasesStore.setState({ loading: false, error: message })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** Reset the store back to initial state — used by tests. */
export function resetOtaReleasesStore(): void {
  inFlight = null
  useOtaReleasesStore.setState(initial, true)
}
