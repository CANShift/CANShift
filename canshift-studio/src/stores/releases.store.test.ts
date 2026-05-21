// releases.store.test.ts — Behaviour contract for the GitHub release info
// store (issue #905). Mirrors the assertions the hook test used to own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LatestReleaseResult } from '@tmbk/canshift-core'

const getLatestMock = vi.fn<(force?: boolean) => Promise<LatestReleaseResult>>()

vi.mock('../services/ipc.service', () => ({
  releasesIpc: {
    getLatest: (force?: boolean): Promise<LatestReleaseResult> => getLatestMock(force),
  },
}))

import { useReleasesStore } from './releases.store'

function makeOkResult(version: string): LatestReleaseResult {
  return {
    ok: true,
    release: {
      version,
      tag: `v${version}`,
      name: `CANShift ${version}`,
      notes: '',
      publishedAt: '2026-05-09T12:00:00Z',
      prerelease: false,
      htmlUrl: `https://github.com/tburkhalterr/CANShift/releases/tag/v${version}`,
      assets: [],
    },
    prerelease: null,
    fetchedAt: '2026-05-09T12:01:00Z',
    fromCache: false,
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
  getLatestMock.mockReset()
  useReleasesStore.setState({
    state: { status: 'loading', previous: null },
    isFetching: false,
  })
})

afterEach(() => {
  useReleasesStore.setState({
    state: { status: 'loading', previous: null },
    isFetching: false,
  })
})

describe('releases.store', () => {
  it('starts in loading with no previous result', () => {
    const s = useReleasesStore.getState()
    expect(s.state.status).toBe('loading')
    if (s.state.status === 'loading') {
      expect(s.state.previous).toBeNull()
    }
    expect(s.isFetching).toBe(false)
  })

  it('loadLatest() flips to ready with the IPC result and clears isFetching', async () => {
    const pending = deferred<LatestReleaseResult>()
    getLatestMock.mockReturnValueOnce(pending.promise)

    const loadPromise = useReleasesStore.getState().loadLatest()
    expect(useReleasesStore.getState().isFetching).toBe(true)

    pending.resolve(makeOkResult('0.8.3'))
    await loadPromise

    const s = useReleasesStore.getState()
    expect(s.state.status).toBe('ready')
    if (s.state.status === 'ready' && s.state.result.ok) {
      expect(s.state.result.release.version).toBe('0.8.3')
    }
    expect(s.isFetching).toBe(false)
    expect(getLatestMock).toHaveBeenCalledWith(false)
  })

  it('loadLatest() is idempotent while a fetch is in flight', async () => {
    const pending = deferred<LatestReleaseResult>()
    getLatestMock.mockReturnValueOnce(pending.promise)

    const first = useReleasesStore.getState().loadLatest()
    const second = useReleasesStore.getState().loadLatest()

    pending.resolve(makeOkResult('0.8.3'))
    await Promise.all([first, second])

    expect(getLatestMock).toHaveBeenCalledTimes(1)
  })

  it('refresh() preserves the previous result during the in-flight fetch', async () => {
    getLatestMock.mockResolvedValueOnce(makeOkResult('0.8.3'))
    await useReleasesStore.getState().loadLatest()

    const refreshPending = deferred<LatestReleaseResult>()
    getLatestMock.mockReturnValueOnce(refreshPending.promise)

    const refreshPromise = useReleasesStore.getState().refresh()
    const inFlight = useReleasesStore.getState()
    expect(inFlight.state.status).toBe('loading')
    if (inFlight.state.status === 'loading') {
      expect(inFlight.state.previous?.ok).toBe(true)
    }

    refreshPending.resolve(makeOkResult('0.8.4'))
    await refreshPromise

    const s = useReleasesStore.getState()
    expect(s.state.status).toBe('ready')
    if (s.state.status === 'ready' && s.state.result.ok) {
      expect(s.state.result.release.version).toBe('0.8.4')
    }
    expect(getLatestMock).toHaveBeenNthCalledWith(2, true)
  })

  it('surfaces IPC rejections as an offline-style ready result', async () => {
    getLatestMock.mockRejectedValueOnce(new Error('IPC channel closed'))

    await useReleasesStore.getState().loadLatest()

    const s = useReleasesStore.getState()
    expect(s.state.status).toBe('ready')
    if (s.state.status === 'ready' && !s.state.result.ok) {
      expect(s.state.result.reason).toBe('offline')
      expect(s.state.result.message).toMatch(/IPC channel closed/)
    }
    expect(s.isFetching).toBe(false)
  })
})
