import { CURRENT_SCHEMA_VERSION, DashboardConfigSchema, migrateConfig } from '@tmbk/canshift-core'
import type { DashboardConfig } from '@tmbk/canshift-core'

export const AUTOSAVE_KEY = 'canshift.tuner.autosave'
export const AUTOSAVE_DEBOUNCE_MS = 500

export interface AutosavePayload {
  config: DashboardConfig
  isDirty: boolean
  selectedPageId: string | null
  selectedWidgetId: string | null
  selectedWidgetIds: string[]
  savedAt: number
}

interface AutosaveSource {
  config: DashboardConfig | null
  isDirty: boolean
  selectedPageId: string | null
  selectedWidgetId: string | null
  selectedWidgetIds: string[]
}

export const serializeAutosave = (state: AutosaveSource, savedAt: number): string | null => {
  if (!state.config) return null
  const payload: AutosavePayload = {
    config: state.config,
    isDirty: state.isDirty,
    selectedPageId: state.selectedPageId,
    selectedWidgetId: state.selectedWidgetId,
    selectedWidgetIds: state.selectedWidgetIds,
    savedAt,
  }
  return JSON.stringify(payload)
}

export const parseAutosave = (raw: string): AutosavePayload | null => {
  let outer: unknown
  try {
    outer = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof outer !== 'object' || outer === null) return null
  const candidate = outer as Record<string, unknown>
  if (typeof candidate.savedAt !== 'number') return null

  let migrated: Record<string, unknown>
  try {
    migrated = migrateConfig(
      candidate.config as Record<string, unknown>,
      CURRENT_SCHEMA_VERSION
    ).config
  } catch {
    return null
  }
  const parsed = DashboardConfigSchema.safeParse(migrated)
  if (!parsed.success) return null
  const config = parsed.data as DashboardConfig

  const pageIds = new Set(config.pages.map((p) => p.id))
  const widgetIds = new Set(config.pages.flatMap((p) => p.widgets.map((w) => w.id)))
  const selectedPageId =
    typeof candidate.selectedPageId === 'string' && pageIds.has(candidate.selectedPageId)
      ? candidate.selectedPageId
      : (config.pages[0]?.id ?? null)
  const selectedWidgetId =
    typeof candidate.selectedWidgetId === 'string' && widgetIds.has(candidate.selectedWidgetId)
      ? candidate.selectedWidgetId
      : null
  const selectedWidgetIds = Array.isArray(candidate.selectedWidgetIds)
    ? candidate.selectedWidgetIds.filter(
        (id): id is string => typeof id === 'string' && widgetIds.has(id)
      )
    : []

  return {
    config,
    isDirty: candidate.isDirty === true,
    selectedPageId,
    selectedWidgetId,
    selectedWidgetIds,
    savedAt: candidate.savedAt,
  }
}

export const readAutosave = (): AutosavePayload | null => {
  if (typeof window === 'undefined') return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(AUTOSAVE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  const payload = parseAutosave(raw)
  if (payload === null) {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY)
    } catch {
      void 0
    }
  }
  return payload
}

interface AutosaveStore {
  getState: () => AutosaveSource & { markAutosaved: (ts: number) => void }
  subscribe: (listener: () => void) => () => void
}

export const startAutosave = (store: AutosaveStore): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  let timer: number | null = null
  let lastWritten: AutosaveSource | null = null

  const snapshot = (): AutosaveSource => {
    const s = store.getState()
    return {
      config: s.config,
      isDirty: s.isDirty,
      selectedPageId: s.selectedPageId,
      selectedWidgetId: s.selectedWidgetId,
      selectedWidgetIds: s.selectedWidgetIds,
    }
  }

  const sameAsWritten = (s: AutosaveSource): boolean =>
    lastWritten !== null &&
    lastWritten.config === s.config &&
    lastWritten.selectedPageId === s.selectedPageId &&
    lastWritten.selectedWidgetId === s.selectedWidgetId &&
    lastWritten.selectedWidgetIds === s.selectedWidgetIds

  const write = () => {
    const s = snapshot()
    if (sameAsWritten(s)) return
    const savedAt = Date.now()
    const raw = serializeAutosave(s, savedAt)
    if (raw === null) return
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, raw)
    } catch {
      return
    }
    lastWritten = s
    store.getState().markAutosaved(savedAt)
  }

  const scheduleWrite = () => {
    if (sameAsWritten(snapshot())) return
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      write()
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  const flush = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    write()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }

  const unsubscribe = store.subscribe(scheduleWrite)
  window.addEventListener('beforeunload', flush)
  window.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    unsubscribe()
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    window.removeEventListener('beforeunload', flush)
    window.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
