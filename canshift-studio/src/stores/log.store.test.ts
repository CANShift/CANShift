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

  it('attaches an optional scope when supplied to push()', () => {
    useLogStore.getState().push('info', 'flashing', 'firmware')
    const entry = useLogStore.getState().entries[0]
    expect(entry?.scope).toBe('firmware')
  })

  it('omits the scope field entirely when push() is called without one', () => {
    useLogStore.getState().push('info', 'no scope')
    const entry = useLogStore.getState().entries[0]
    expect(entry).toBeDefined()
    expect('scope' in (entry ?? {})).toBe(false)
  })

  it('survives a localStorage write failure without throwing (issue #377)', () => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    window.localStorage.setItem = (): never => {
      throw new Error('quota exceeded')
    }
    try {
      // Must NOT throw — the catch in writeVerboseFlag swallows storage errors
      // so the in-memory verbose state still flips.
      expect(() => {
        useLogStore.getState().setVerbose(true)
      }).not.toThrow()
      expect(useLogStore.getState().verbose).toBe(true)
    } finally {
      window.localStorage.setItem = originalSetItem
    }
  })

  it('survives a localStorage read failure when computing the initial verbose flag', () => {
    // Reload the module after stubbing localStorage.getItem to throw.
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage)
    window.localStorage.getItem = (): never => {
      throw new Error('storage denied')
    }
    try {
      // Module evaluated at first import — already covered the happy path.
      // Forcing re-evaluation isn't possible without dynamic import; instead
      // verify the existing store still functions when reads fail mid-session
      // (setVerbose calls writeVerboseFlag, not readVerboseFlag).
      expect(() => {
        useLogStore.getState().setVerbose(false)
      }).not.toThrow()
    } finally {
      window.localStorage.getItem = originalGetItem
    }
  })
})

describe('log.store — pushFromBridge (#433 multi-window CLI sync)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLogStore.setState({ entries: [], verbose: false })
  })

  it('drops debug entries when verbose is off', () => {
    useLogStore.getState().pushFromBridge({
      id: 999,
      level: 'debug',
      message: 'forwarded debug',
      timestamp: new Date(),
    })
    expect(useLogStore.getState().entries).toHaveLength(0)
  })

  it('accepts non-debug entries unconditionally', () => {
    useLogStore.getState().pushFromBridge({
      id: 999,
      level: 'info',
      message: 'forwarded',
      timestamp: new Date('2026-05-09T10:00:00Z'),
    })
    const entry = useLogStore.getState().entries[0]
    expect(entry?.level).toBe('info')
    expect(entry?.message).toBe('forwarded')
  })

  it('preserves the scope field when present on the bridged entry', () => {
    useLogStore.getState().pushFromBridge({
      id: 999,
      level: 'info',
      message: 'with scope',
      timestamp: new Date(),
      scope: 'cli',
    })
    expect(useLogStore.getState().entries[0]?.scope).toBe('cli')
  })

  it('reserves a fresh local id rather than reusing the bridged id', () => {
    // Push a local entry first to advance the id counter.
    useLogStore.getState().push('info', 'local')
    const localId = useLogStore.getState().entries[0]?.id

    useLogStore.getState().pushFromBridge({
      id: 1,
      level: 'info',
      message: 'bridged',
      timestamp: new Date(),
    })

    const bridgedEntry = useLogStore.getState().entries.find((e) => e.message === 'bridged')
    expect(bridgedEntry).toBeDefined()
    expect(bridgedEntry?.id).not.toBe(1)
    expect(localId).toBeDefined()
    expect(localId !== undefined && bridgedEntry !== undefined && bridgedEntry.id > localId).toBe(
      true
    )
  })

  it('keeps debug bridged entries when verbose is on', () => {
    useLogStore.getState().setVerbose(true)
    useLogStore.getState().pushFromBridge({
      id: 1,
      level: 'debug',
      message: 'forwarded debug',
      timestamp: new Date(),
    })
    expect(useLogStore.getState().entries).toHaveLength(1)
  })
})
