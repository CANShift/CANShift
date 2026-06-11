import { useEffect, useState } from 'react'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import { fetchReleases, ReleaseFetchFailed } from '../lib/firmware/releases'

export type FirmwareReleasesState =
  | { kind: 'loading' }
  | { kind: 'ok'; releases: ReleaseInfo[] }
  | { kind: 'error'; message: string }

export interface UseFirmwareReleases {
  state: FirmwareReleasesState
  refresh: () => void
}

export const useFirmwareReleases = (): UseFirmwareReleases => {
  const [state, setState] = useState<FirmwareReleasesState>({ kind: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    void fetchReleases()
      .then((releases) => {
        if (cancelled) return
        setState({ kind: 'ok', releases })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof ReleaseFetchFailed
            ? err.detail.message
            : err instanceof Error
              ? err.message
              : String(err)
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = () => {
    setTick((t) => t + 1)
  }

  return { state, refresh }
}
