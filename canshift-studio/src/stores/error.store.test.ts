// error.store.test.ts — Behaviour contract for the active-errors store
// surfaced by ErrorBar. Covers push, pushOrUpdate (upsert), dismiss, clear,
// FIFO truncation past MAX_ERRORS, and id monotonicity.

import { beforeEach, describe, expect, it } from 'vitest'
import { useErrorStore } from './error.store'

const MAX_ERRORS = 20

describe('error.store', () => {
  beforeEach(() => {
    useErrorStore.setState({ errors: [] })
  })

  it('starts with an empty error list', () => {
    expect(useErrorStore.getState().errors).toEqual([])
  })

  it('push() prepends a new error (newest first)', () => {
    useErrorStore.getState().push({ source: 'usb', code: 'E1', message: 'first' })
    useErrorStore.getState().push({ source: 'usb', code: 'E2', message: 'second' })

    const messages = useErrorStore.getState().errors.map((e) => e.message)
    expect(messages).toEqual(['second', 'first'])
  })

  it('push() stamps a unique monotonically increasing id and a timestamp', () => {
    useErrorStore.getState().push({ source: 'system', code: 'X', message: 'a' })
    useErrorStore.getState().push({ source: 'system', code: 'X', message: 'b' })

    const errors = useErrorStore.getState().errors
    expect(errors).toHaveLength(2)
    const [latest, older] = errors
    expect(latest && older && latest.id > older.id).toBe(true)
    expect(latest?.timestamp).toBeInstanceOf(Date)
  })

  it('push() preserves an optional detail field', () => {
    useErrorStore.getState().push({
      source: 'config',
      code: 'PARSE',
      message: 'bad json',
      detail: 'unexpected token at line 4',
    })

    const entry = useErrorStore.getState().errors[0]
    expect(entry?.detail).toBe('unexpected token at line 4')
  })

  it('push() caps the list at MAX_ERRORS, dropping the oldest', () => {
    for (let i = 0; i < MAX_ERRORS + 5; i++) {
      useErrorStore.getState().push({
        source: 'can',
        code: `code-${i.toString()}`,
        message: `msg-${i.toString()}`,
      })
    }

    const errors = useErrorStore.getState().errors
    expect(errors).toHaveLength(MAX_ERRORS)
    // The newest entry is the latest pushed (index = MAX_ERRORS + 4).
    expect(errors[0]?.message).toBe(`msg-${(MAX_ERRORS + 4).toString()}`)
    // Oldest still present is index 5 (0..4 dropped).
    expect(errors[errors.length - 1]?.message).toBe('msg-5')
  })

  it('pushOrUpdate() inserts when no entry shares source+code', () => {
    useErrorStore.getState().pushOrUpdate({ source: 'usb', code: 'A', message: 'one' })
    useErrorStore.getState().pushOrUpdate({ source: 'usb', code: 'B', message: 'two' })

    const errors = useErrorStore.getState().errors
    expect(errors).toHaveLength(2)
    expect(errors.map((e) => e.code)).toEqual(['B', 'A'])
  })

  it('pushOrUpdate() updates an existing entry by source+code without changing its id', () => {
    useErrorStore.getState().pushOrUpdate({
      source: 'can',
      code: 'BUS_OFF',
      message: 'first',
    })
    const originalId = useErrorStore.getState().errors[0]?.id

    useErrorStore.getState().pushOrUpdate({
      source: 'can',
      code: 'BUS_OFF',
      message: 'updated',
      detail: 'now with detail',
    })

    const errors = useErrorStore.getState().errors
    expect(errors).toHaveLength(1)
    const entry = errors[0]
    expect(entry?.id).toBe(originalId)
    expect(entry?.message).toBe('updated')
    expect(entry?.detail).toBe('now with detail')
  })

  it('pushOrUpdate() keeps a previously-set detail when the update omits it', () => {
    useErrorStore.getState().pushOrUpdate({
      source: 'system',
      code: 'OOM',
      message: 'low memory',
      detail: 'heap=87%',
    })

    useErrorStore.getState().pushOrUpdate({
      source: 'system',
      code: 'OOM',
      message: 'still low',
    })

    const entry = useErrorStore.getState().errors[0]
    expect(entry?.message).toBe('still low')
    expect(entry?.detail).toBe('heap=87%')
  })

  it('pushOrUpdate() distinguishes entries that share source but differ in code', () => {
    useErrorStore.getState().pushOrUpdate({ source: 'can', code: 'A', message: 'one' })
    useErrorStore.getState().pushOrUpdate({ source: 'can', code: 'B', message: 'two' })

    const errors = useErrorStore.getState().errors
    expect(errors).toHaveLength(2)
  })

  it('dismiss() removes the matching id and leaves the rest', () => {
    useErrorStore.getState().push({ source: 'usb', code: 'A', message: 'a' })
    useErrorStore.getState().push({ source: 'usb', code: 'B', message: 'b' })
    const target = useErrorStore.getState().errors[0]
    if (!target) throw new Error('no error to dismiss')

    useErrorStore.getState().dismiss(target.id)

    const remaining = useErrorStore.getState().errors
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.code).toBe('A')
  })

  it('dismiss() with an unknown id is a no-op', () => {
    useErrorStore.getState().push({ source: 'usb', code: 'A', message: 'a' })
    useErrorStore.getState().dismiss(999_999)

    expect(useErrorStore.getState().errors).toHaveLength(1)
  })

  it('clear() empties the list', () => {
    useErrorStore.getState().push({ source: 'usb', code: 'A', message: 'a' })
    useErrorStore.getState().push({ source: 'usb', code: 'B', message: 'b' })

    useErrorStore.getState().clear()

    expect(useErrorStore.getState().errors).toEqual([])
  })
})
