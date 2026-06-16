import { DAY_THEME_PRESET } from '../../constants/theme'
import { DEFAULT_SIM_CONFIG } from '../../config/default-sim-config'
import { pushHistory } from './helpers'
import type { LifecycleSlice, LoadFromDeviceOrDemoResult, SliceCreator } from './types'

export const createLifecycleSlice: SliceCreator<LifecycleSlice> = (set) => ({
  config: null,
  filePath: null,
  isDirty: false,
  loadedFromDemoFallback: false,
  pendingDeviceConfig: null,

  setConfig: (config, filePath) => {
    set((s) => {
      s.past = []
      s.future = []
      s.config = config
      s.config.dayTheme ??= DAY_THEME_PRESET
      s.filePath = filePath ?? null
      s.isDirty = false
      s.selectedPageId = config.defaultPageId
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
      s.loadedFromDemoFallback = false
      s.pendingDeviceConfig = null
    })
  },

  setEcuProfileKey: (key) => {
    set((s) => {
      if (s.config) {
        s.config.ecuProfileKey = key
        s.isDirty = true
      }
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

  loadImported: (config) => {
    set((s) => {
      s.past = []
      s.future = []
      s.config = config
      s.filePath = null
      s.isDirty = true
      s.selectedPageId = config.defaultPageId
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
      s.loadedFromDemoFallback = false
      s.pendingDeviceConfig = null
    })
  },

  loadFromDeviceOrDemo: (deviceConfig) => {
    let outcome: LoadFromDeviceOrDemoResult = 'kept-edits'
    set((s) => {
      if (deviceConfig) {
        s.past = []
        s.future = []
        s.config = deviceConfig
        s.filePath = null
        s.isDirty = false
        s.selectedPageId = deviceConfig.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        s.loadedFromDemoFallback = false
        s.pendingDeviceConfig = null
        outcome = 'device'
        return
      }
      if (s.config === null) {
        s.past = []
        s.future = []
        s.config = structuredClone(DEFAULT_SIM_CONFIG)
        s.filePath = null
        s.isDirty = false
        s.selectedPageId = DEFAULT_SIM_CONFIG.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        s.loadedFromDemoFallback = true
        s.pendingDeviceConfig = null
        outcome = 'demo'
        return
      }
      outcome = 'kept-edits'
    })
    return outcome
  },

  stagePendingDeviceConfig: (deviceConfig) => {
    set((s) => {
      s.pendingDeviceConfig = deviceConfig
    })
  },

  acceptPendingDeviceConfig: () => {
    set((s) => {
      const pending = s.pendingDeviceConfig
      if (!pending) return
      s.past = []
      s.future = []
      s.config = pending
      s.filePath = null
      s.isDirty = false
      s.selectedPageId = pending.defaultPageId
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
      s.loadedFromDemoFallback = false
      s.pendingDeviceConfig = null
    })
  },

  dismissPendingDeviceConfig: () => {
    set((s) => {
      s.pendingDeviceConfig = null
    })
  },

  clearDemoFallback: () => {
    set((s) => {
      s.loadedFromDemoFallback = false
    })
  },

  markSaved: (filePath) => {
    set((s) => {
      s.filePath = filePath
      s.isDirty = false
    })
  },

  markPushed: () => {
    set((s) => {
      s.isDirty = false
    })
  },
})
