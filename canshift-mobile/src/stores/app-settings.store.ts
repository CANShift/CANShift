import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'
import { log } from './log.store'

export type AppTheme = 'system' | 'light' | 'dark'
export type Units = 'metric' | 'imperial'
export type ReconnectBehavior = 'auto' | 'off'

export const TELEMETRY_BUFFER_OPTIONS = [1000, 3000, 6000] as const
export type TelemetryBufferSize = (typeof TELEMETRY_BUFFER_OPTIONS)[number]

const STORAGE_KEY = 'canshift.mobile.appSettings'
const LEGACY_PRE_RELEASE_KEY = 'canshift.mobile.releases.showPrerelease'

const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  telemetryBufferSize: z.union([z.literal(1000), z.literal(3000), z.literal(6000)]),
  reconnectBehavior: z.enum(['auto', 'off']),
  showPreRelease: z.boolean(),
  units: z.enum(['metric', 'imperial']),
})

export type AppSettings = z.infer<typeof settingsSchema>

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  telemetryBufferSize: 3000,
  reconnectBehavior: 'auto',
  showPreRelease: true,
  units: 'metric',
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const readPersisted = async (): Promise<AppSettings | null> => {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    if (raw === null) return null
    const parsed = settingsSchema.safeParse(JSON.parse(raw) as unknown)
    return parsed.success ? parsed.data : null
  } catch (err) {
    log('warn', `Failed to read app settings — using defaults: ${errText(err)}`)
    return null
  }
}

const writePersisted = async (settings: AppSettings): Promise<void> => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    log('warn', `Failed to persist app settings: ${errText(err)}`)
  }
}

const migrateLegacyPreRelease = async (): Promise<boolean | null> => {
  try {
    const legacy = await SecureStore.getItemAsync(LEGACY_PRE_RELEASE_KEY)
    if (legacy === null) return null
    await SecureStore.deleteItemAsync(LEGACY_PRE_RELEASE_KEY)
    return legacy !== 'false'
  } catch (err) {
    log('warn', `Failed to migrate pre-release preference: ${errText(err)}`)
    return null
  }
}

interface AppSettingsState extends AppSettings {
  hydrated: boolean
  hydrate: () => Promise<void>
  setTheme: (theme: AppTheme) => void
  setTelemetryBufferSize: (size: TelemetryBufferSize) => void
  setReconnectBehavior: (behavior: ReconnectBehavior) => void
  setShowPreRelease: (value: boolean) => void
  setUnits: (units: Units) => void
}

const snapshot = (state: AppSettings): AppSettings => ({
  theme: state.theme,
  telemetryBufferSize: state.telemetryBufferSize,
  reconnectBehavior: state.reconnectBehavior,
  showPreRelease: state.showPreRelease,
  units: state.units,
})

export const useAppSettingsStore = create<AppSettingsState>()((set, get) => {
  const update = (patch: Partial<AppSettings>): void => {
    set(patch)
    void writePersisted(snapshot(get()))
  }

  return {
    ...DEFAULT_SETTINGS,
    hydrated: false,

    hydrate: async () => {
      if (get().hydrated) return
      const persisted = await readPersisted()
      if (persisted !== null) {
        set({ ...persisted, hydrated: true })
        return
      }
      const migrated = await migrateLegacyPreRelease()
      const next: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...(migrated !== null ? { showPreRelease: migrated } : {}),
      }
      set({ ...next, hydrated: true })
      void writePersisted(next)
    },

    setTheme: (theme) => {
      update({ theme })
    },
    setTelemetryBufferSize: (telemetryBufferSize) => {
      update({ telemetryBufferSize })
    },
    setReconnectBehavior: (reconnectBehavior) => {
      update({ reconnectBehavior })
    },
    setShowPreRelease: (showPreRelease) => {
      update({ showPreRelease })
    },
    setUnits: (units) => {
      update({ units })
    },
  }
})
