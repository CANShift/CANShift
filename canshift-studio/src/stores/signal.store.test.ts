// signal.store.test.ts

import { beforeEach, describe, expect, it } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore, DEFAULT_PROFILE_KEY } from './signal.store'

const DUMMY: SignalDef = {
  name: 'rpm',
  canFrameId: '0x370',
  startByte: 0,
  byteLength: 2,
  bigEndian: false,
  signed: false,
  scale: 1,
  offset: 0,
  unit: 'rpm',
  min: 0,
  max: 10000,
  timeoutMs: 500,
}

describe('signal.store', () => {
  beforeEach(() => {
    localStorage.clear()
    useSignalStore.setState({ signals: [], selectedProfileKey: DEFAULT_PROFILE_KEY })
  })

  it('starts empty with the default profile key when no localStorage entry exists', () => {
    expect(useSignalStore.getState().signals).toEqual([])
    expect(useSignalStore.getState().selectedProfileKey).toBe(DEFAULT_PROFILE_KEY)
  })

  it('setSignals() replaces the list in memory', () => {
    useSignalStore.getState().setSignals([DUMMY])
    expect(useSignalStore.getState().signals).toHaveLength(1)
    expect(useSignalStore.getState().signals[0]?.name).toBe('rpm')
  })

  it('setSignals([]) clears the list', () => {
    useSignalStore.getState().setSignals([DUMMY])
    useSignalStore.getState().setSignals([])
    expect(useSignalStore.getState().signals).toEqual([])
  })

  it('applyProfile() updates state and writes to localStorage', () => {
    const key = 'xml:../assets/realdash/MaxxECU/maxxecu_default_can.xml'
    useSignalStore.getState().applyProfile(key, [DUMMY])

    const state = useSignalStore.getState()
    expect(state.selectedProfileKey).toBe(key)
    expect(state.signals).toHaveLength(1)

    const stored = JSON.parse(localStorage.getItem('canshift:signal-store-v1') ?? '{}') as {
      selectedProfileKey: string
      signals: SignalDef[]
    }
    expect(stored.selectedProfileKey).toBe(key)
    expect(stored.signals).toHaveLength(1)
  })

  it('setSignals() does not update the persisted profile key', () => {
    useSignalStore.getState().applyProfile(DEFAULT_PROFILE_KEY, [])
    useSignalStore.getState().setSignals([DUMMY])

    const stored = JSON.parse(localStorage.getItem('canshift:signal-store-v1') ?? '{}') as {
      selectedProfileKey: string
    }
    // applyProfile wrote the key; setSignals did not overwrite it
    expect(stored.selectedProfileKey).toBe(DEFAULT_PROFILE_KEY)
  })
})
