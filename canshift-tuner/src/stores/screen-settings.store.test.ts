import { describe, it, expect, beforeEach } from 'vitest'
import { useScreenSettingsStore, type StoredScreenSettings } from './screen-settings.store'

const DEFAULTS: StoredScreenSettings = { brightness: 80, sleep: 0, rotation: 0 }

describe('screen-settings.store (#1705)', () => {
  beforeEach(() => {
    useScreenSettingsStore.getState().update(DEFAULTS)
  })

  it('exposes core-shaped defaults with a sleep field', () => {
    const s = useScreenSettingsStore.getState()
    expect(s.brightness).toBe(80)
    expect(s.sleep).toBe(0)
    expect(s.rotation).toBe(0)
  })

  it('updates a single field without touching the others', () => {
    useScreenSettingsStore.getState().update({ brightness: 40 })
    const s = useScreenSettingsStore.getState()
    expect(s.brightness).toBe(40)
    expect(s.sleep).toBe(0)
    expect(s.rotation).toBe(0)
  })

  it('preserves the last-known sleep across unrelated updates', () => {
    useScreenSettingsStore.getState().update({ sleep: 300 })
    useScreenSettingsStore.getState().update({ brightness: 60 })
    useScreenSettingsStore.getState().update({ rotation: 180 })
    const s = useScreenSettingsStore.getState()
    expect(s.sleep).toBe(300)
    expect(s.brightness).toBe(60)
    expect(s.rotation).toBe(180)
  })
})
