// useLatestRelease.test.tsx — Lock the state machine of the GitHub release
// info hook (issue #571).
//
// The hook coordinates the IPC fetch lifecycle: it starts in `loading`, lands
// on `ready` once the main process answers, and on `refresh()` it must NOT
// drop the previously-rendered result back to the skeleton — the card stays
// visible while we re-fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { IpcChannels } from '../../shared/ipc-channels'

const getLatestMock = vi.fn<(force?: boolean) => Promise<LatestReleaseResult>>()

vi.mock('../services/ipc.service', () => ({
  releasesIpc: {
    getLatest: (force?: boolean): Promise<LatestReleaseResult> => getLatestMock(force),
  },
}))

import { useLatestRelease, type UseLatestReleaseReturn } from './useLatestRelease'
import { useReleasesStore } from '../stores/releases.store'

function makeOkResult(version: string, fromCache = false): LatestReleaseResult {
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
    fromCache,
  }
}

let container: HTMLDivElement | null = null
let root: Root | null = null
let captured: UseLatestReleaseReturn | null = null

function Harness(): null {
  captured = useLatestRelease()
  return null
}

async function mountHarness(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<Harness />)
    await Promise.resolve()
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

beforeEach(() => {
  getLatestMock.mockReset()
  // Reset the singleton store so each test starts from a clean loading state.
  useReleasesStore.setState({
    state: { status: 'loading', previous: null },
    isFetching: false,
  })
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      channels: IpcChannels,
    },
  })
})

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  if (container !== null) {
    container.remove()
    container = null
  }
  captured = null
})

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

describe('useLatestRelease', () => {
  it('starts in loading and lands on ready with the IPC result', async () => {
    const pending = deferred<LatestReleaseResult>()
    getLatestMock.mockReturnValueOnce(pending.promise)

    await mountHarness()
    // Initial render — still loading, no previous payload.
    expect(captured?.state.status).toBe('loading')
    if (captured?.state.status === 'loading') {
      expect(captured.state.previous).toBeNull()
    }
    expect(captured?.isFetching).toBe(true)

    await act(async () => {
      pending.resolve(makeOkResult('0.8.3'))
      await pending.promise
    })
    await flush()

    expect(captured?.state.status).toBe('ready')
    if (captured?.state.status === 'ready') {
      expect(captured.state.result.ok).toBe(true)
      if (captured.state.result.ok) {
        expect(captured.state.result.release.version).toBe('0.8.3')
      }
    }
    expect(captured?.isFetching).toBe(false)
    expect(getLatestMock).toHaveBeenCalledWith(false)
  })

  it('refresh() forces a fetch and preserves the previous result while loading', async () => {
    getLatestMock.mockResolvedValueOnce(makeOkResult('0.8.3'))

    await mountHarness()
    await flush()
    await flush()

    expect(captured?.state.status).toBe('ready')

    const refreshPending = deferred<LatestReleaseResult>()
    getLatestMock.mockReturnValueOnce(refreshPending.promise)

    await act(async () => {
      captured?.refresh()
      await Promise.resolve()
    })

    // While the second fetch is in-flight, the previous result should still
    // be available — the card must not flash back to a skeleton.
    expect(captured?.state.status).toBe('loading')
    if (captured?.state.status === 'loading') {
      expect(captured.state.previous?.ok).toBe(true)
    }

    await act(async () => {
      refreshPending.resolve(makeOkResult('0.8.4'))
      await refreshPending.promise
    })
    await flush()

    expect(captured?.state.status).toBe('ready')
    if (captured?.state.status === 'ready' && captured.state.result.ok) {
      expect(captured.state.result.release.version).toBe('0.8.4')
    }
    expect(getLatestMock).toHaveBeenNthCalledWith(2, true)
  })

  it('surfaces IPC rejections as an offline-style result', async () => {
    getLatestMock.mockRejectedValueOnce(new Error('IPC channel closed'))

    await mountHarness()
    await flush()
    await flush()

    expect(captured?.state.status).toBe('ready')
    if (captured?.state.status === 'ready') {
      expect(captured.state.result.ok).toBe(false)
      if (!captured.state.result.ok) {
        expect(captured.state.result.reason).toBe('offline')
        expect(captured.state.result.message).toMatch(/IPC channel closed/)
      }
    }
  })
})
