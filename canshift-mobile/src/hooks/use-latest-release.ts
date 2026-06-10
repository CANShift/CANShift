import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { loadReleases, useReleasesStore, type LatestReleaseStatus } from '../stores/releases.store'

export type LatestReleaseState = LatestReleaseStatus

export interface UseLatestReleaseReturn {
  state: LatestReleaseState
  isFetching: boolean
  refresh: () => void
}

export const useLatestRelease = (): UseLatestReleaseReturn => {
  const { latest, isFetching, loadCount } = useReleasesStore(
    useShallow((s) => ({
      latest: s.latest,
      isFetching: s.isFetching,
      loadCount: s.loadCount,
    }))
  )

  useEffect(() => {
    if (loadCount === 0) void loadReleases(false)
  }, [])

  const refresh = (): void => {
    void loadReleases(true)
  }

  return { state: latest, isFetching, refresh }
}

export type { LatestReleaseResult }
