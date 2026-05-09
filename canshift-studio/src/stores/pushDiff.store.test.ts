// pushDiff.store.test.ts — Behaviour contract for the "diff before burn"
// confirmation dialog state.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { usePushDiffStore } from './pushDiff.store'

function makeConfig(name: string): DashboardConfig {
  return {
    version: '1.10.0',
    name,
    description: '',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    topBar: { height: 16, bgColor: '#0D0D0D', textColor: '#AAAAAA' },
    pages: [
      {
        id: 'p1',
        backgroundImage: null,
        backgroundColor: '#000000',
        showTopBar: true,
        palette: {
          surface: '#1E1E1E',
          primary: '#FF4444',
          accent: '#FF8800',
          text: '#FFFFFF',
          textDim: '#888888',
          warning: '#FF8800',
          danger: '#FF4444',
          success: '#00CC44',
        },
        widgets: [],
      },
    ],
  }
}

describe('pushDiff.store', () => {
  beforeEach(() => {
    usePushDiffStore.setState({
      visible: false,
      currentConfig: null,
      lastPushedConfig: null,
      onConfirm: null,
    })
  })

  it('starts hidden with no configs and no callback', () => {
    const state = usePushDiffStore.getState()
    expect(state.visible).toBe(false)
    expect(state.currentConfig).toBeNull()
    expect(state.lastPushedConfig).toBeNull()
    expect(state.onConfirm).toBeNull()
  })

  it('show() captures both configs and the confirm callback and flips visible', () => {
    const current = makeConfig('current')
    const last = makeConfig('last')
    const onConfirm = vi.fn()

    usePushDiffStore.getState().show(current, last, onConfirm)

    const state = usePushDiffStore.getState()
    expect(state.visible).toBe(true)
    expect(state.currentConfig).toBe(current)
    expect(state.lastPushedConfig).toBe(last)
    expect(state.onConfirm).toBe(onConfirm)
  })

  it('show() accepts a null lastPushedConfig (first burn)', () => {
    const current = makeConfig('current')
    const onConfirm = vi.fn()

    usePushDiffStore.getState().show(current, null, onConfirm)

    const state = usePushDiffStore.getState()
    expect(state.visible).toBe(true)
    expect(state.currentConfig).toBe(current)
    expect(state.lastPushedConfig).toBeNull()
  })

  it('dismiss() clears every field back to the initial state', () => {
    usePushDiffStore.getState().show(makeConfig('a'), makeConfig('b'), vi.fn())

    usePushDiffStore.getState().dismiss()

    const state = usePushDiffStore.getState()
    expect(state.visible).toBe(false)
    expect(state.currentConfig).toBeNull()
    expect(state.lastPushedConfig).toBeNull()
    expect(state.onConfirm).toBeNull()
  })
})
