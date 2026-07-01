import { DAY_THEME_PRESET } from '../../constants/theme'
import { DEFAULT_SIM_CONFIG } from '../../config/default-sim-config'
import { pushHistory } from './helpers'
import type { LifecycleSlice, LoadFromDeviceOrDemoResult, SliceCreator } from './types'

export const createLifecycleSlice: SliceCreator<LifecycleSlice> = (set) => ({
  config: null,
  isDirty: false,

  setConfig: (config) => {
    set((s) => {
      s.past = []
      s.future = []
      s.config = config
      s.config.dayTheme ??= DAY_THEME_PRESET
      s.isDirty = false
      s.selectedPageId = config.defaultPageId
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
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
        s.past = []
        s.future = []
        s.config = deviceConfig
        s.isDirty = false
        s.selectedPageId = deviceConfig.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        outcome = 'device'
        return
      }
      if (s.config === null) {
        s.past = []
        s.future = []
        s.config = structuredClone(DEFAULT_SIM_CONFIG)
        s.isDirty = false
        s.selectedPageId = DEFAULT_SIM_CONFIG.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        outcome = 'demo'
        return
      }
      outcome = 'kept-edits'
    })
    return outcome
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
