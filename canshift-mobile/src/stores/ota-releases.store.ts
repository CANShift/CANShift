import { create } from 'zustand'
import type { ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'
import { RELEASE_MERGED_ASSET_SUFFIX, RELEASE_OTA_ASSET_SUFFIX } from '../constants/ota'
import type { FirmwareRelease } from '../services/ota.service'
import { releasesService } from '../services/releases.service'

const SHA256_DIGEST_RE = /^sha256:([a-f0-9]{64})$/

const parseSha256Digest = (digest: string | null | undefined): string | null => {
  if (digest == null) return null
  const m = SHA256_DIGEST_RE.exec(digest)
  return m ? (m[1] ?? null) : null
}

const pickOtaAsset = (assets: ReleaseAsset[]): ReleaseAsset | null => {
  return (
    assets.find(
      (a) =>
        a.name.endsWith(RELEASE_OTA_ASSET_SUFFIX) && !a.name.endsWith(RELEASE_MERGED_ASSET_SUFFIX)
    ) ?? null
  )
}

const toFirmwareRelease = (r: ReleaseInfo): FirmwareRelease | null => {
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
  loadCount: number
}

const initial: OtaReleasesState = {
  releases: [],
  loading: false,
  error: null,
  loadCount: 0,
}

export const useOtaReleasesStore = create<OtaReleasesState>(() => initial)

let inFlight: Promise<void> | null = null

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

export const resetOtaReleasesStore = (): void => {
  inFlight = null
  useOtaReleasesStore.setState(initial, true)
}
