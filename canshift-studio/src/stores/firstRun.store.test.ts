// firstRun.store.test.ts — Behaviour contract for the first-run onboarding
// store (issue #1015, S-H-3). Mirrors the assertions the hook held in local
// state before the migration.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getFirstRunCompletedMock = vi.fn<() => Promise<boolean>>()
const markFirstRunCompletedMock = vi.fn<() => Promise<void>>()

vi.mock('../services/ipc.service', () => ({
  sessionIpc: {
    getFirstRunCompleted: (): Promise<boolean> => getFirstRunCompletedMock(),
    markFirstRunCompleted: (): Promise<void> => markFirstRunCompletedMock(),
  },
}))

import { useFirstRunStore } from './firstRun.store'

beforeEach(() => {
  getFirstRunCompletedMock.mockReset()
  markFirstRunCompletedMock.mockReset()
  useFirstRunStore.setState({ status: 'loading', isLoading: false })
})

afterEach(() => {
  useFirstRunStore.setState({ status: 'loading', isLoading: false })
})

describe('firstRun.store', () => {
  it('starts in loading with no fetch in flight', () => {
    const s = useFirstRunStore.getState()
    expect(s.status).toBe('loading')
    expect(s.isLoading).toBe(false)
  })

  it('load() resolves to pending when the flag is false', async () => {
    getFirstRunCompletedMock.mockResolvedValueOnce(false)

    await useFirstRunStore.getState().load()

    const s = useFirstRunStore.getState()
    expect(s.status).toBe('pending')
    expect(s.isLoading).toBe(false)
  })

  it('load() resolves to completed when the flag is true', async () => {
    getFirstRunCompletedMock.mockResolvedValueOnce(true)

    await useFirstRunStore.getState().load()

    expect(useFirstRunStore.getState().status).toBe('completed')
  })

  it('load() is idempotent — extra calls do not refetch', async () => {
    getFirstRunCompletedMock.mockResolvedValueOnce(false)

    await useFirstRunStore.getState().load()
    await useFirstRunStore.getState().load()
    await useFirstRunStore.getState().load()

    expect(getFirstRunCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('treats IPC failures as completed so onboarding never traps the user', async () => {
    getFirstRunCompletedMock.mockRejectedValueOnce(new Error('userData corrupt'))

    await useFirstRunStore.getState().load()

    expect(useFirstRunStore.getState().status).toBe('completed')
  })

  it('markCompleted() flips status and persists best-effort via IPC', () => {
    markFirstRunCompletedMock.mockResolvedValueOnce(undefined)

    useFirstRunStore.getState().markCompleted()

    expect(useFirstRunStore.getState().status).toBe('completed')
    expect(markFirstRunCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('markCompleted() swallows persistence failures', () => {
    markFirstRunCompletedMock.mockRejectedValueOnce(new Error('write failed'))

    useFirstRunStore.getState().markCompleted()

    expect(useFirstRunStore.getState().status).toBe('completed')
  })
})
