// screenSettings.store.test.ts — Behaviour contract for physical screen
// display settings (brightness, sleep timeout, mounting rotation).

import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenSettingsStore } from './screenSettings.store'

const DEFAULTS = { brightness: 80, sleepTimeoutS: 0, rotation: 0 } as const

describe('screenSettings.store', () => {
  beforeEach(() => {
    useScreenSettingsStore.setState({ ...DEFAULTS })
  })

  it('exposes the documented defaults on init', () => {
    const state = useScreenSettingsStore.getState()
    expect(state.brightness).toBe(80)
    expect(state.sleepTimeoutS).toBe(0)
    expect(state.rotation).toBe(0)
  })

  it('set() merges a partial patch without clobbering other keys', () => {
    useScreenSettingsStore.getState().set({ brightness: 25 })

    const state = useScreenSettingsStore.getState()
    expect(state.brightness).toBe(25)
    expect(state.sleepTimeoutS).toBe(0)
    expect(state.rotation).toBe(0)
  })

  it('set() can update multiple keys at once', () => {
    useScreenSettingsStore.getState().set({ brightness: 50, sleepTimeoutS: 30, rotation: 180 })

    const state = useScreenSettingsStore.getState()
    expect(state.brightness).toBe(50)
    expect(state.sleepTimeoutS).toBe(30)
    expect(state.rotation).toBe(180)
  })

  it('set({}) is a no-op that preserves the state', () => {
    useScreenSettingsStore.getState().set({ brightness: 42 })
    useScreenSettingsStore.getState().set({})

    const state = useScreenSettingsStore.getState()
    expect(state.brightness).toBe(42)
    expect(state.sleepTimeoutS).toBe(0)
    expect(state.rotation).toBe(0)
  })

  it('reset() restores all keys to their defaults', () => {
    useScreenSettingsStore.getState().set({ brightness: 10, sleepTimeoutS: 60, rotation: 180 })

    useScreenSettingsStore.getState().reset()

    const state = useScreenSettingsStore.getState()
    expect(state.brightness).toBe(80)
    expect(state.sleepTimeoutS).toBe(0)
    expect(state.rotation).toBe(0)
  })

  it('accepts a 180° rotation offset (literal-typed but exhaustive)', () => {
    useScreenSettingsStore.getState().set({ rotation: 180 })
    expect(useScreenSettingsStore.getState().rotation).toBe(180)
  })
})
