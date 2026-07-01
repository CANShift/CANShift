import type { DashboardConfig } from '@tmbk/canshift-core'
import { DAY_THEME_PRESET } from '../../constants/theme'
import { DEFAULT_SIM_CONFIG } from '../../config/default-sim-config'
import { pushHistory } from './helpers'
import type { DashboardState, LifecycleSlice, LoadFromDeviceOrDemoResult, SliceCreator } from './types'

const applyLoadedConfig = (s: DashboardState, config: DashboardConfig): void => {
  s.past = []
  s.future = []
  s.config = config
  s.isDirty = false
  s.selectedPageId = config.defaultPageId
  s.selectedWidgetId = null
  s.selectedWidgetIds = []
  s.pendingDeviceConfig = null
}

export const createLifecycleSlice: SliceCreator<LifecycleSlice> = (set) => ({
  config: null,
  isDirty: false,
  pendingDeviceConfig: null,

  setConfig: (config) => {
    set((s) => {
      applyLoadedConfig(s, { ...config, dayTheme: config.dayTheme ?? DAY_THEME_PRESET })
    })
  },

  setTargetProfile: (id) => {
    set((s) => {
      if (!s.config) return
      if (s.config.targetProfile === id) return
      pushHistory(s)
      s.config.targetProfile = id
      s.isDirty = true
    })
  },

  loadFromDeviceOrDemo: (deviceConfig) => {
    let outcome: LoadFromDeviceOrDemoResult = 'kept-edits'
    set((s) => {
      if (deviceConfig) {
        if (s.config !== null && s.isDirty) {
          s.pendingDeviceConfig = deviceConfig
          outcome = 'staged'
          return
        }
        applyLoadedConfig(s, deviceConfig)
        outcome = 'device'
        return
      }
      if (s.config === null) {
        applyLoadedConfig(s, structuredClone(DEFAULT_SIM_CONFIG))
        outcome = 'demo'
        return
      }
      outcome = 'kept-edits'
    })
    return outcome
  },

  acceptPendingDeviceConfig: () => {
    set((s) => {
      const pending = s.pendingDeviceConfig
      if (!pending) return
      applyLoadedConfig(s, pending)
    })
  },

  dismissPendingDeviceConfig: () => {
    set((s) => {
      s.pendingDeviceConfig = null
    })
  },

  markPushed: () => {
    set((s) => {
      s.isDirty = false
    })
  },

  markDirty: () => {
    set((s) => {
      if (s.config) s.isDirty = true
    })
  },
})
