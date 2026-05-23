// inputBindings.store.test.ts — Behaviour contract for the physical GPIO
// bindings store (issue #1015, S-H-3).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InputBinding, InputBindingsConfig } from '@tmbk/canshift-core'

const readMock = vi.fn<() => Promise<{ success: boolean; config: InputBindingsConfig | null }>>()
const writeMock = vi.fn<(c: InputBindingsConfig) => Promise<{ success: boolean; error?: string }>>()

vi.mock('../services/ipc.service', () => ({
  inputBindingsIpc: {
    read: () => readMock(),
    write: (c: InputBindingsConfig) => writeMock(c),
  },
}))

import { useInputBindingsStore } from './inputBindings.store'

function makeBinding(id: string): InputBinding {
  return {
    id,
    pin: 32,
    active: 'low',
    pullup: true,
    debounceMs: 20,
    kind: 'short',
    action: { category: 'dashboard', type: 'navigate', pageId: '' },
  }
}

beforeEach(() => {
  readMock.mockReset()
  writeMock.mockReset()
  useInputBindingsStore.setState({
    bindings: [],
    loaded: false,
    saveStatus: 'idle',
    saveError: null,
  })
})

afterEach(() => {
  useInputBindingsStore.setState({
    bindings: [],
    loaded: false,
    saveStatus: 'idle',
    saveError: null,
  })
})

describe('inputBindings.store', () => {
  it('starts empty and unloaded', () => {
    const s = useInputBindingsStore.getState()
    expect(s.bindings).toEqual([])
    expect(s.loaded).toBe(false)
    expect(s.saveStatus).toBe('idle')
  })

  it('load() pulls bindings from IPC and marks loaded', async () => {
    readMock.mockResolvedValueOnce({
      success: true,
      config: { inputBindings: [makeBinding('a')] },
    })

    await useInputBindingsStore.getState().load()

    const s = useInputBindingsStore.getState()
    expect(s.loaded).toBe(true)
    expect(s.bindings).toHaveLength(1)
    expect(s.bindings[0]?.id).toBe('a')
  })

  it('load() is idempotent — second call skips the IPC', async () => {
    readMock.mockResolvedValueOnce({
      success: true,
      config: { inputBindings: [] },
    })

    await useInputBindingsStore.getState().load()
    await useInputBindingsStore.getState().load()

    expect(readMock).toHaveBeenCalledTimes(1)
  })

  it('load() still marks loaded when IPC reports no config', async () => {
    readMock.mockResolvedValueOnce({ success: false, config: null })

    await useInputBindingsStore.getState().load()

    const s = useInputBindingsStore.getState()
    expect(s.loaded).toBe(true)
    expect(s.bindings).toEqual([])
  })

  it('load() swallows IPC failures and marks loaded', async () => {
    readMock.mockRejectedValueOnce(new Error('bridge down'))

    await useInputBindingsStore.getState().load()

    expect(useInputBindingsStore.getState().loaded).toBe(true)
  })

  it('updateBinding() patches a single entry by index', () => {
    useInputBindingsStore.setState({
      bindings: [makeBinding('a'), makeBinding('b')],
      loaded: true,
    })

    useInputBindingsStore.getState().updateBinding(1, { pin: 27 })

    const next = useInputBindingsStore.getState().bindings
    expect(next[1]?.pin).toBe(27)
    expect(next[0]?.pin).toBe(32)
  })

  it('addBinding() / removeBinding() mutate the draft', () => {
    useInputBindingsStore.getState().addBinding(makeBinding('a'))
    useInputBindingsStore.getState().addBinding(makeBinding('b'))
    useInputBindingsStore.getState().removeBinding(0)

    const next = useInputBindingsStore.getState().bindings
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('b')
  })

  it('save() flips status to saved on success', async () => {
    useInputBindingsStore.setState({ bindings: [makeBinding('a')], loaded: true })
    writeMock.mockResolvedValueOnce({ success: true })

    await useInputBindingsStore.getState().save()

    const s = useInputBindingsStore.getState()
    expect(s.saveStatus).toBe('saved')
    expect(s.saveError).toBeNull()
    expect(writeMock).toHaveBeenCalledWith({ inputBindings: [makeBinding('a')] })
  })

  it('save() surfaces the IPC error message on failure', async () => {
    writeMock.mockResolvedValueOnce({ success: false, error: 'disk full' })

    await useInputBindingsStore.getState().save()

    const s = useInputBindingsStore.getState()
    expect(s.saveStatus).toBe('error')
    expect(s.saveError).toBe('disk full')
  })

  it('save() surfaces thrown errors with their message', async () => {
    writeMock.mockRejectedValueOnce(new Error('timed out'))

    await useInputBindingsStore.getState().save()

    const s = useInputBindingsStore.getState()
    expect(s.saveStatus).toBe('error')
    expect(s.saveError).toBe('timed out')
  })

  it('clearSaveStatus() resets the transient save flags', () => {
    useInputBindingsStore.setState({ saveStatus: 'saved', saveError: null })

    useInputBindingsStore.getState().clearSaveStatus()

    expect(useInputBindingsStore.getState().saveStatus).toBe('idle')
  })
})
