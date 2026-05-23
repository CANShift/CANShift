// firmwareReleases.store.test.ts — Behaviour contract for the channel-keyed
// firmware release-list store (issue #1015, S-H-3).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirmwareRelease } from '../services/ipc.service'

const listReleasesMock = vi.fn<(channel: 'stable' | 'beta') => Promise<FirmwareRelease[]>>()

vi.mock('../services/ipc.service', () => ({
  firmwareIpc: {
    listReleases: (channel: 'stable' | 'beta'): Promise<FirmwareRelease[]> =>
      listReleasesMock(channel),
  },
}))

import { useFirmwareReleasesStore, emptyChannelState } from './firmwareReleases.store'

function makeRelease(version: string): FirmwareRelease {
  return {
    version,
    tag: `v${version}`,
    publishedAt: '2026-05-09T12:00:00Z',
    prerelease: false,
    notes: '',
    downloadUrl: `https://example.com/${version}.bin`,
    payloadBytes: 1024,
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  let reject: (err: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  listReleasesMock.mockReset()
  useFirmwareReleasesStore.setState({
    byChannel: { stable: emptyChannelState(), beta: emptyChannelState() },
  })
})

afterEach(() => {
  useFirmwareReleasesStore.setState({
    byChannel: { stable: emptyChannelState(), beta: emptyChannelState() },
  })
})

describe('firmwareReleases.store', () => {
  it('starts with empty channel state for both channels', () => {
    const s = useFirmwareReleasesStore.getState()
    expect(s.byChannel.stable.releases).toEqual([])
    expect(s.byChannel.stable.loading).toBe(false)
    expect(s.byChannel.beta.loaded).toBe(false)
  })

  it('loadChannel("stable") flips loading then resolves with the IPC list', async () => {
    const pending = deferred<FirmwareRelease[]>()
    listReleasesMock.mockReturnValueOnce(pending.promise)

    const fetchPromise = useFirmwareReleasesStore.getState().loadChannel('stable')
    expect(useFirmwareReleasesStore.getState().byChannel.stable.loading).toBe(true)

    pending.resolve([makeRelease('0.9.0'), makeRelease('0.8.3')])
    await fetchPromise

    const s = useFirmwareReleasesStore.getState().byChannel.stable
    expect(s.loading).toBe(false)
    expect(s.releases).toHaveLength(2)
    expect(s.releases[0]?.version).toBe('0.9.0')
    expect(s.loaded).toBe(true)
    expect(s.error).toBeNull()
  })

  it('loadChannel is keyed per channel — beta does not affect stable', async () => {
    listReleasesMock.mockResolvedValueOnce([makeRelease('0.9.0')])
    await useFirmwareReleasesStore.getState().loadChannel('stable')

    listReleasesMock.mockResolvedValueOnce([makeRelease('0.10.0-beta.1')])
    await useFirmwareReleasesStore.getState().loadChannel('beta')

    const s = useFirmwareReleasesStore.getState().byChannel
    expect(s.stable.releases[0]?.version).toBe('0.9.0')
    expect(s.beta.releases[0]?.version).toBe('0.10.0-beta.1')
  })

  it('loadChannel skips concurrent calls for the same channel', async () => {
    const pending = deferred<FirmwareRelease[]>()
    listReleasesMock.mockReturnValueOnce(pending.promise)

    const first = useFirmwareReleasesStore.getState().loadChannel('stable')
    const second = useFirmwareReleasesStore.getState().loadChannel('stable')

    pending.resolve([makeRelease('0.9.0')])
    await Promise.all([first, second])

    expect(listReleasesMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces IPC failures into the channel error field', async () => {
    listReleasesMock.mockRejectedValueOnce(new Error('GitHub 503'))

    await useFirmwareReleasesStore.getState().loadChannel('stable')

    const s = useFirmwareReleasesStore.getState().byChannel.stable
    expect(s.loading).toBe(false)
    expect(s.releases).toEqual([])
    expect(s.error).toMatch(/GitHub 503/)
    expect(s.loaded).toBe(true)
  })

  it('clears the previous error when a new fetch starts', async () => {
    listReleasesMock.mockRejectedValueOnce(new Error('temporary'))
    await useFirmwareReleasesStore.getState().loadChannel('stable')
    expect(useFirmwareReleasesStore.getState().byChannel.stable.error).toMatch(/temporary/)

    listReleasesMock.mockResolvedValueOnce([makeRelease('0.9.0')])
    await useFirmwareReleasesStore.getState().loadChannel('stable')

    const s = useFirmwareReleasesStore.getState().byChannel.stable
    expect(s.error).toBeNull()
    expect(s.releases).toHaveLength(1)
  })
})
