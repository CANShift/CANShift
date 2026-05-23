// firmwareReleases.store.ts — GitHub firmware release listings (issue #1015,
// S-H-3).
//
// Pre-refactor, `UpdateRoute` fired `firmwareIpc.listReleases(channel)` from
// inside `useEffect` whenever the user flipped between the `stable` / `beta`
// channel tabs and held the resulting list + loading/error flags in local
// `useState`. That's the "useEffect for data fetching" anti-pattern the
// studio rule explicitly bans.
//
// Channel results are cached so flipping back to a previously fetched channel
// is instant. The component becomes a thin selector that schedules a single
// `loadChannel(channel)` call when the channel changes.

import { create } from 'zustand'
import { firmwareIpc, type FirmwareRelease } from '../services/ipc.service'

export type FirmwareChannel = 'stable' | 'beta'

interface ChannelState {
  releases: FirmwareRelease[]
  loading: boolean
  error: string | null
  /** True once a fetch has resolved at least once (success or failure). */
  loaded: boolean
}

interface FirmwareReleasesState {
  byChannel: Record<FirmwareChannel, ChannelState>
  /**
   * Fetch the release list for `channel`. Idempotent while a fetch for the
   * same channel is in flight; otherwise re-fetches so the user can recover
   * from a transient network failure by switching tabs back.
   */
  loadChannel: (channel: FirmwareChannel) => Promise<void>
}

const EMPTY_CHANNEL: ChannelState = {
  releases: [],
  loading: false,
  error: null,
  loaded: false,
}

export function emptyChannelState(): ChannelState {
  return { ...EMPTY_CHANNEL }
}

export const useFirmwareReleasesStore = create<FirmwareReleasesState>()((set, get) => ({
  byChannel: {
    stable: emptyChannelState(),
    beta: emptyChannelState(),
  },

  loadChannel: async (channel) => {
    const current = get().byChannel[channel]
    // Already in flight — let the original caller resolve. Avoids racing
    // multiple parallel fetches when the user double-clicks a tab.
    if (current.loading) return

    set((s) => ({
      byChannel: {
        ...s.byChannel,
        [channel]: { ...s.byChannel[channel], loading: true, error: null },
      },
    }))

    try {
      const releases = await firmwareIpc.listReleases(channel)
      set((s) => ({
        byChannel: {
          ...s.byChannel,
          [channel]: { releases, loading: false, error: null, loaded: true },
        },
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch releases'
      set((s) => ({
        byChannel: {
          ...s.byChannel,
          [channel]: { releases: [], loading: false, error: message, loaded: true },
        },
      }))
    }
  },
}))
