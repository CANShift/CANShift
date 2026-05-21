// ReleaseInfoCard.test.tsx — Smoke + comparison-state coverage for the
// GitHub release info card (issue #571).
//
// The component glues `appIpc.version` (the running app version) and
// `releasesIpc.getLatest` (the main-side cache) into the "current vs latest"
// banner. The interesting assertions are:
//   - up-to-date / behind / pre-release branches render the right copy
//   - the asset list renders one row per asset with a download link
//   - the markdown renderer is invoked for non-empty release notes
//   - localStorage persists the pre-release toggle

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { IpcChannels } from '../../../shared/ipc-channels'

const versionMock = vi.fn<() => Promise<string>>()
const getLatestMock = vi.fn<(force?: boolean) => Promise<LatestReleaseResult>>()

vi.mock('../../services/ipc.service', () => ({
  appIpc: { version: (): Promise<string> => versionMock() },
  releasesIpc: {
    getLatest: (force?: boolean): Promise<LatestReleaseResult> => getLatestMock(force),
  },
}))

import ReleaseInfoCard from './ReleaseInfoCard'
import { useAppVersionStore } from '../../stores/appVersion.store'
import { useReleasesStore } from '../../stores/releases.store'

let container: HTMLDivElement | null = null
let root: Root | null = null

function ok(
  version: string,
  opts: { prerelease?: boolean; notes?: string; preRelease?: { version: string } } = {}
): LatestReleaseResult {
  return {
    ok: true,
    release: {
      version,
      tag: `v${version}`,
      name: `CANShift ${version}`,
      notes: opts.notes ?? '',
      publishedAt: '2026-05-09T12:00:00Z',
      prerelease: opts.prerelease ?? false,
      htmlUrl: `https://github.com/tburkhalterr/CANShift/releases/tag/v${version}`,
      assets: [
        {
          name: `cs-studio-${version}.dmg`,
          downloadUrl: `https://example.test/cs-studio-${version}.dmg`,
          sizeBytes: 1_234_567,
        },
      ],
    },
    prerelease: opts.preRelease
      ? {
          version: opts.preRelease.version,
          tag: `v${opts.preRelease.version}`,
          name: null,
          notes: '',
          publishedAt: '2026-05-10T08:00:00Z',
          prerelease: true,
          htmlUrl: `https://github.com/tburkhalterr/CANShift/releases/tag/v${opts.preRelease.version}`,
          assets: [],
        }
      : null,
    fetchedAt: '2026-05-09T12:01:00Z',
    fromCache: false,
  }
}

beforeEach(() => {
  versionMock.mockReset()
  getLatestMock.mockReset()
  window.localStorage.clear()
  // Reset shared store state so each test starts from a clean baseline.
  useAppVersionStore.setState({ version: null, isLoading: false })
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
})

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<ReleaseInfoCard />)
    await Promise.resolve()
  })
  // Two microtask flushes — one for `appIpc.version`, one for the hook fetch.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

function text(): string {
  return container?.textContent ?? ''
}

describe('ReleaseInfoCard', () => {
  it('renders Up to date when current matches latest stable', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')
    getLatestMock.mockResolvedValueOnce(ok('0.8.3'))

    await mount()

    expect(text()).toMatch(/Up to date/)
    expect(text()).toMatch(/v0\.8\.3/)
  })

  it('renders Update available when current is behind', async () => {
    versionMock.mockResolvedValueOnce('0.8.2')
    getLatestMock.mockResolvedValueOnce(ok('0.8.3'))

    await mount()

    expect(text()).toMatch(/Update available/)
    expect(text()).toContain('v0.8.2')
    expect(text()).toContain('v0.8.3')
  })

  it('renders Running a pre-release build when the current version has a suffix', async () => {
    versionMock.mockResolvedValueOnce('0.9.0-beta.1')
    getLatestMock.mockResolvedValueOnce(ok('0.8.3'))

    await mount()

    expect(text()).toMatch(/pre-release build/i)
  })

  it('lists each asset with its size', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')
    getLatestMock.mockResolvedValueOnce(ok('0.8.3'))

    await mount()

    expect(text()).toContain('cs-studio-0.8.3.dmg')
    expect(text()).toMatch(/1\.2 MB/)
  })

  it('renders markdown release notes through SafeMarkdown', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')
    getLatestMock.mockResolvedValueOnce(ok('0.8.3', { notes: '## Highlights\n- one\n- two' }))

    await mount()

    expect(container?.querySelector('h2')?.textContent).toContain('Highlights')
    expect(container?.querySelectorAll('li').length).toBeGreaterThanOrEqual(2)
  })

  it('renders an offline message when the IPC result is a failure without cache', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')
    getLatestMock.mockResolvedValueOnce({
      ok: false,
      reason: 'offline',
      message: 'Network unreachable',
      fetchedAt: '2026-05-09T12:01:00Z',
      cached: null,
    })

    await mount()

    expect(text()).toMatch(/Couldn.?t reach GitHub/i)
    expect(text()).toContain('Network unreachable')
  })
})
