// stores/__tests__/log-store.test.ts — Coverage for the application log
// store's verbose-gated push + cross-window bridge handling (#1077 follow-up).
//
// `useLogStore` ships two write paths:
//   - `push(level, message, scope?)` — local entries; debug lines are
//     suppressed when `verbose === false` to keep the visible console readable
//   - `pushFromBridge(entry)` — entries forwarded from another renderer
//     (#433); must NOT be re-broadcast → tagged with `bridged: true` so the
//     outbound subscriber in `useCliLogBridge` skips them
//
// We rebuild the store between cases with `vi.resetModules()` so the
// internal `nextId` counter and the verbose flag start from a known value.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LogEntry } from '../log.store'

const storage: Record<string, string> = {}

beforeEach(() => {
  for (const k of Object.keys(storage)) delete storage[k]
  vi.resetModules()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => {
      storage[k] = v
    },
    removeItem: (k: string) => {
      delete storage[k]
    },
    clear: () => {
      for (const k of Object.keys(storage)) delete storage[k]
    },
    key: () => null,
    length: 0,
  }
  ;(globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: globalThis.localStorage,
  }
})

describe('log.store — push + verbose gating', () => {
  it('drops debug entries when verbose is off', async () => {
    const { useLogStore } = await import('../log.store')
    expect(useLogStore.getState().verbose).toBe(false)
    useLogStore.getState().push('debug', 'noisy')
    expect(useLogStore.getState().entries).toEqual([])
  })

  it('keeps debug entries when verbose is on', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().setVerbose(true)
    useLogStore.getState().push('debug', 'noisy')
    expect(useLogStore.getState().entries.length).toBe(1)
    expect(useLogStore.getState().entries[0]?.level).toBe('debug')
  })

  it('keeps info/warn/error/success entries regardless of verbose', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().push('info', 'i')
    useLogStore.getState().push('warn', 'w')
    useLogStore.getState().push('error', 'e')
    useLogStore.getState().push('success', 's')
    expect(useLogStore.getState().entries.map((e) => e.level)).toEqual([
      'info',
      'warn',
      'error',
      'success',
    ])
  })

  it('attaches the scope tag when one is provided', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().push('info', 'hello', 'device')
    const entry = useLogStore.getState().entries[0]
    expect(entry?.scope).toBe('device')
  })

  it('clear() empties the entries list', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().push('info', 'a')
    useLogStore.getState().push('info', 'b')
    expect(useLogStore.getState().entries.length).toBe(2)
    useLogStore.getState().clear()
    expect(useLogStore.getState().entries).toEqual([])
  })

  it('setVerbose persists the toggle to localStorage', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().setVerbose(true)
    expect(storage['canshift.log.verbose']).toBe('1')
    useLogStore.getState().setVerbose(false)
    expect(storage['canshift.log.verbose']).toBe('0')
  })
})

describe('log.store — pushFromBridge', () => {
  it('tags bridged entries with bridged:true so they are not re-broadcast', async () => {
    const { useLogStore } = await import('../log.store')
    const incoming: LogEntry = {
      id: 999, // remote id — should be ignored, a fresh local id is allocated
      level: 'info',
      message: 'from peer',
      timestamp: new Date(),
    }
    useLogStore.getState().pushFromBridge(incoming)
    const entry = useLogStore.getState().entries[0]
    expect(entry?.bridged).toBe(true)
    expect(entry?.id).not.toBe(999)
    expect(entry?.message).toBe('from peer')
  })

  it('respects verbose gating for bridged debug entries', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().pushFromBridge({
      id: 1,
      level: 'debug',
      message: 'quiet',
      timestamp: new Date(),
    })
    expect(useLogStore.getState().entries).toEqual([])
  })

  it('preserves scope on bridged entries when provided', async () => {
    const { useLogStore } = await import('../log.store')
    useLogStore.getState().pushFromBridge({
      id: 1,
      level: 'info',
      message: 'tagged',
      timestamp: new Date(),
      scope: 'device',
    })
    expect(useLogStore.getState().entries[0]?.scope).toBe('device')
  })
})
