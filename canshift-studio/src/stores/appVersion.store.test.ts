// appVersion.store.test.ts — Behaviour contract for the studio version
// singleton store (issue #905). Asserts the loadVersion action is idempotent
// across multiple callers (4 components share it).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const versionMock = vi.fn<() => Promise<string>>()

vi.mock('../services/ipc.service', () => ({
  appIpc: { version: (): Promise<string> => versionMock() },
}))

import { useAppVersionStore } from './appVersion.store'

beforeEach(() => {
  versionMock.mockReset()
  useAppVersionStore.setState({ version: null, isLoading: false })
})

afterEach(() => {
  useAppVersionStore.setState({ version: null, isLoading: false })
})

describe('appVersion.store', () => {
  it('starts with no version and not loading', () => {
    const s = useAppVersionStore.getState()
    expect(s.version).toBeNull()
    expect(s.isLoading).toBe(false)
  })

  it('loadVersion() resolves the IPC version into state', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')

    await useAppVersionStore.getState().loadVersion()

    const s = useAppVersionStore.getState()
    expect(s.version).toBe('0.8.3')
    expect(s.isLoading).toBe(false)
  })

  it('loadVersion() is idempotent — extra calls do not refetch', async () => {
    versionMock.mockResolvedValueOnce('0.8.3')

    await useAppVersionStore.getState().loadVersion()
    await useAppVersionStore.getState().loadVersion()
    await useAppVersionStore.getState().loadVersion()

    expect(versionMock).toHaveBeenCalledTimes(1)
    expect(useAppVersionStore.getState().version).toBe('0.8.3')
  })

  it('swallows IPC failures and leaves version null', async () => {
    versionMock.mockRejectedValueOnce(new Error('bridge down'))

    await useAppVersionStore.getState().loadVersion()

    const s = useAppVersionStore.getState()
    expect(s.version).toBeNull()
    expect(s.isLoading).toBe(false)
  })

  it('does not start a second fetch while one is in flight', async () => {
    let resolveFn: (v: string) => void = () => undefined
    versionMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveFn = resolve
      })
    )

    const first = useAppVersionStore.getState().loadVersion()
    const second = useAppVersionStore.getState().loadVersion()
    expect(useAppVersionStore.getState().isLoading).toBe(true)

    resolveFn('0.8.3')
    await Promise.all([first, second])

    expect(versionMock).toHaveBeenCalledTimes(1)
  })
})
