import type { CSSProperties } from 'react'
import {
  MAX_CYCLE_STATES,
  MIN_CYCLE_STATES,
  type ButtonAction,
  type ButtonWidgetConfig,
  type CruiseControlOp,
  type PageConfig,
  type SingleActionButtonConfig,
} from '@tmbk/canshift-core'

export type CycleConfig = Exclude<ButtonWidgetConfig, SingleActionButtonConfig>
export type CycleState = CycleConfig['states'][number]

export const CRUISE_STEP_OPS = new Set<CruiseControlOp>(['increment', 'decrement'])

export const HEX_FRAME_ID_REGEX = /^(0[xX])?[0-9a-fA-F]{1,8}$/

export const EMPTY_PAGES: readonly PageConfig[] = []

export const defaultNavigateAction = (pageIds: string[]): ButtonAction => ({
  category: 'dashboard',
  type: 'navigate',
  pageId: pageIds[0] ?? '',
})

export interface ActionPreset {
  label: string
  color: string
  build: () => ButtonAction
}

export const buildActionPresets = (pageIds: string[]): ActionPreset[] => [
  {
    label: 'Navigate',
    color: '#5577CC',
    build: () => defaultNavigateAction(pageIds),
  },
  {
    label: 'Map Switch',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'map_switch', mapIndex: 1 }),
  },
  {
    label: 'CAN Raw',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'can_raw', frameId: 0, data: '' }),
  },
  {
    label: 'Cruise Ctrl',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'cruise_control', op: 'toggle' }),
  },
]

type SharedConfigFields = Pick<
  ButtonWidgetConfig,
  'label' | 'iconName' | 'iconPath' | 'showIcon' | 'showLabel' | 'colors'
>

const extractSharedFields = (cfg: ButtonWidgetConfig): SharedConfigFields => ({
  label: cfg.label,
  ...(cfg.iconName !== undefined ? { iconName: cfg.iconName } : {}),
  ...(cfg.iconPath !== undefined ? { iconPath: cfg.iconPath } : {}),
  ...(cfg.showIcon !== undefined ? { showIcon: cfg.showIcon } : {}),
  ...(cfg.showLabel !== undefined ? { showLabel: cfg.showLabel } : {}),
  ...(cfg.colors !== undefined ? { colors: cfg.colors } : {}),
})

export const convertSingleToCycle = (
  cfg: SingleActionButtonConfig,
  pageIds: string[]
): ButtonWidgetConfig => {
  const fallback = defaultNavigateAction(pageIds)
  const states: CycleState[] = []
  const seed = cfg.actions.slice(0, MAX_CYCLE_STATES)
  for (let i = 0; i < Math.max(MIN_CYCLE_STATES, seed.length); i++) {
    const action = seed[i] ?? fallback
    states.push({ label: `State ${String(i + 1)}`, action })
  }
  return {
    type: 'button',
    mode: 'cycle',
    ...extractSharedFields(cfg),
    states,
    initialActiveIndex: 0,
  }
}

export const convertCycleToSingle = (cfg: CycleConfig, pageIds: string[]): ButtonWidgetConfig => {
  const activeState = cfg.states[cfg.initialActiveIndex] ?? cfg.states[0]
  const action = activeState?.action ?? defaultNavigateAction(pageIds)
  return {
    type: 'button',
    mode: 'single',
    ...extractSharedFields(cfg),
    actions: [action],
  }
}

export const modePillStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  fontSize: 11,
  padding: '5px 8px',
  background: active ? '#1A2A4A' : 'transparent',
  border: `1px solid ${active ? '#5577CC' : '#2A2A2A'}`,
  borderRadius: 3,
  color: active ? '#7788CC' : '#666666',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
})
