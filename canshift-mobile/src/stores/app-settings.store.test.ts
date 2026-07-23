import * as SecureStore from 'expo-secure-store'
import { useAppSettingsStore, type AppSettings } from './app-settings.store'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
  }
})

const mockStore = (SecureStore as unknown as { __store: Map<string, string> }).__store
const STORAGE_KEY = 'canshift.mobile.appSettings'
const LEGACY_PRE_RELEASE_KEY = 'canshift.mobile.releases.showPrerelease'

const resetStore = (): void => {
  mockStore.clear()
  jest.clearAllMocks()
  useAppSettingsStore.setState({
    theme: 'system',
    telemetryBufferSize: 3000,
    reconnectBehavior: 'auto',
    showPreRelease: true,
    units: 'metric',
    hydrated: false,
  })
}

describe('app-settings.store', () => {
  beforeEach(resetStore)

  it('exposes sensible defaults before hydration', () => {
    const s = useAppSettingsStore.getState()
    expect(s.hydrated).toBe(false)
    expect(s.theme).toBe('system')
    expect(s.telemetryBufferSize).toBe(3000)
    expect(s.reconnectBehavior).toBe('auto')
    expect(s.showPreRelease).toBe(true)
    expect(s.units).toBe('metric')
  })

  it('persists a setting change and reflects it in state', async () => {
    useAppSettingsStore.getState().setUnits('imperial')
    expect(useAppSettingsStore.getState().units).toBe('imperial')
    await Promise.resolve()
    const raw = mockStore.get(STORAGE_KEY)
    expect(raw).toBeDefined()
    const persisted = JSON.parse(raw ?? '{}') as AppSettings
    expect(persisted.units).toBe('imperial')
  })

  it('hydrates from a persisted blob', async () => {
    mockStore.set(
      STORAGE_KEY,
      JSON.stringify({
        theme: 'dark',
        telemetryBufferSize: 6000,
        reconnectBehavior: 'off',
        showPreRelease: false,
        units: 'imperial',
      })
    )
    await useAppSettingsStore.getState().hydrate()
    const s = useAppSettingsStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.theme).toBe('dark')
    expect(s.telemetryBufferSize).toBe(6000)
    expect(s.reconnectBehavior).toBe('off')
    expect(s.showPreRelease).toBe(false)
    expect(s.units).toBe('imperial')
  })

  it('migrates the legacy pre-release preference and clears the old key', async () => {
    mockStore.set(LEGACY_PRE_RELEASE_KEY, 'false')
    await useAppSettingsStore.getState().hydrate()
    expect(useAppSettingsStore.getState().showPreRelease).toBe(false)
    expect(mockStore.has(LEGACY_PRE_RELEASE_KEY)).toBe(false)
    expect(mockStore.get(STORAGE_KEY)).toBeDefined()
  })

  it('falls back to defaults when nothing is persisted', async () => {
    await useAppSettingsStore.getState().hydrate()
    const s = useAppSettingsStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.showPreRelease).toBe(true)
    expect(s.units).toBe('metric')
  })
})
