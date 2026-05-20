// button-action-guards.test.ts — type guard + discriminant tuple

import {
  BUTTON_ACTION_TYPES,
  isCanRawAction,
  isCruiseControlAction,
  isMapSwitchAction,
  isNavigateAction,
} from '../schemas/dashboard.js'
import type {
  ButtonAction,
  CanRawAction,
  CruiseControlAction,
  MapSwitchAction,
  NavigateAction,
} from '../schemas/dashboard.js'

describe('ButtonAction discriminant tuple', () => {
  it('exposes every known (category, type) pair', () => {
    expect(BUTTON_ACTION_TYPES).toEqual([
      { category: 'dashboard', type: 'navigate' },
      { category: 'ecu', type: 'map_switch' },
      { category: 'ecu', type: 'can_raw' },
      { category: 'ecu', type: 'cruise_control' },
    ])
  })
})

describe('ButtonAction type guards', () => {
  const navigate: NavigateAction = { category: 'dashboard', type: 'navigate', pageId: 'p2' }
  const mapSwitch: MapSwitchAction = { category: 'ecu', type: 'map_switch', mapIndex: 2 }
  const canRaw: CanRawAction = { category: 'ecu', type: 'can_raw', frameId: 0x123, data: 'AA' }
  const cruise: CruiseControlAction = { category: 'ecu', type: 'cruise_control', op: 'toggle' }

  it('isNavigateAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw, cruise]
    expect(actions.filter(isNavigateAction)).toEqual([navigate])
  })

  it('isMapSwitchAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw, cruise]
    expect(actions.filter(isMapSwitchAction)).toEqual([mapSwitch])
  })

  it('isCanRawAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw, cruise]
    expect(actions.filter(isCanRawAction)).toEqual([canRaw])
  })

  it('isCruiseControlAction narrows correctly', () => {
    const actions: ButtonAction[] = [navigate, mapSwitch, canRaw, cruise]
    expect(actions.filter(isCruiseControlAction)).toEqual([cruise])
  })

  it('guards are mutually exclusive', () => {
    const all: ButtonAction[] = [navigate, mapSwitch, canRaw, cruise]
    for (const a of all) {
      const matched = [
        isNavigateAction(a),
        isMapSwitchAction(a),
        isCanRawAction(a),
        isCruiseControlAction(a),
      ].filter(Boolean)
      expect(matched).toHaveLength(1)
    }
  })
})
