// ota-releases.store.ts — Zustand store wrapping the firmware-release
// fetch (#905). Moves OtaService.fetchReleases() out of UpdateScreen's
// useEffect into a store action, matching the device/log/signals store
// pattern.
//
// State:
//   - releases: list returned by the last successful fetch, [] otherwise
//   - loading: true while the fetch is in-flight
//   - error: human-readable message from the last failed fetch, null otherwise

import { create } from 'zustand'
import type { FirmwareRelease } from '../services/ota.service'
import * as OtaService from '../services/ota.service'

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
      const releases = await OtaService.fetchReleases()
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
