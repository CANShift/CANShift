// button-action-guards.test.ts — type guard + discriminant tuple

import {
  BUTTON_ACTION_TYPES,
  isCanRawAction,
  isMapSwitchAction,
  isNavigateAction,
} from '../types/dashboard.js'
import type {
  ButtonAction,
  CanRawAction,
  MapSwitchAction,
  NavigateAction,
} from '../types/dashboard.js'

describe('ButtonAction discriminant tuple', () => {
  it('exposes the three known (category, type) pairs', () => {
    expect(BUTTON_ACTION_TYPES).toHaveLength(3)
    expect(BUTTON_ACTION_TYPES).toEqual([
      { category: 'dashboard', type: 'navigate' },
      { category: 'ecu', type: 'map_switch' },
      { category: 'ecu', type: 'can_raw' },
    ])
  })
})

describe('ButtonAction type guards', () => {
  const navigate: NavigateAction = { category: 'dashboard', type: 'navigate', pageId: 'p2' }
  const mapSwitch: MapSwitchAction = { category: 'ecu', type: 'map_switch', mapIndex: 2 }
  const canRaw: CanRawAction = { category: 'ecu', type: 'can_raw', frameId: 0x123, data: 'AA' }

  it('isNavigateAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw]
    expect(actions.filter(isNavigateAction)).toEqual([navigate])
  })

  it('isMapSwitchAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw]
    expect(actions.filter(isMapSwitchAction)).toEqual([mapSwitch])
  })

  it('isCanRawAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw]
    expect(actions.filter(isCanRawAction)).toEqual([canRaw])
  })

  it('guards are mutually exclusive', () => {
    const all: ButtonAction[] = [navigate, mapSwitch, canRaw]
    for (const a of all) {
      const matched = [isNavigateAction(a), isMapSwitchAction(a), isCanRawAction(a)].filter(Boolean)
      expect(matched).toHaveLength(1)
    }
  })
})
