// log.store.test.ts — Behaviour contract for the verbose / debug-level
// gating added in #377. The activity log is the single source of truth for
// device-side operations; debug entries (per-chunk progress) must never
// flood the default view but must be available when the user opts in.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLogStore } from './log.store'

const VERBOSE_STORAGE_KEY = 'canshift.log.verbose'

function resetStore(): void {
  useLogStore.setState({ entries: [], verbose: false })
}

describe('log.store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetStore()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('appends info / warn / error / success entries unconditionally', () => {
    const { push } = useLogStore.getState()

    push('info', 'started')
    push('warn', 'careful')
    push('error', 'boom')
    push('success', 'done')

    const levels = useLogStore.getState().entries.map((e) => e.level)
    expect(levels).toEqual(['info', 'warn', 'error', 'success'])
  })

  it('drops debug entries when verbose is off', () => {
    const { push } = useLogStore.getState()
    push('debug', 'chunk 1/10')
    expect(useLogStore.getState().entries).toHaveLength(0)
  })

  it('keeps debug entries when verbose is on', () => {
    useLogStore.getState().setVerbose(true)
    useLogStore.getState().push('debug', 'chunk 1/10')

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.level).toBe('debug')
    expect(entries[0]?.message).toBe('chunk 1/10')
  })

  it('persists the verbose flag to localStorage', () => {
    useLogStore.getState().setVerbose(true)
    expect(window.localStorage.getItem(VERBOSE_STORAGE_KEY)).toBe('1')

    useLogStore.getState().setVerbose(false)
    expect(window.localStorage.getItem(VERBOSE_STORAGE_KEY)).toBe('0')
  })

  it('clears entries without resetting the verbose flag', () => {
    useLogStore.getState().setVerbose(true)
    useLogStore.getState().push('info', 'one')
    useLogStore.getState().push('debug', 'two')

    useLogStore.getState().clear()

    expect(useLogStore.getState().entries).toEqual([])
    expect(useLogStore.getState().verbose).toBe(true)
  })
})
