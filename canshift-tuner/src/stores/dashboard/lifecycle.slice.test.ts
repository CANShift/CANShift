import { describe, it, expect, beforeEach } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'

const makeConfig = (id: string): DashboardConfig =>
  ({
    version: '1.23.0',
    defaultPageId: id,
    topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
    pages: [{ id, backgroundColor: '#000000', showTopBar: true, visible: true, widgets: [] }],
  }) as unknown as DashboardConfig

describe('loadFromDeviceOrDemo conflict handling (#1741)', () => {
  beforeEach(() => {
    useDashboardStore.setState({ config: null, isDirty: false, pendingDeviceConfig: null })
  })

  it('stages the device config instead of overwriting dirty edits', () => {
    const store = useDashboardStore.getState()
    store.setConfig(makeConfig('local'))
    store.markDirty()

    const deviceConfig = makeConfig('device')
    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(deviceConfig)

    const state = useDashboardStore.getState()
    expect(outcome).toBe('staged')
    expect(state.config?.defaultPageId).toBe('local')
    expect(state.isDirty).toBe(true)
    expect(state.pendingDeviceConfig?.defaultPageId).toBe('device')
  })

  it('accepting the staged config replaces edits and clears dirty state', () => {
    const store = useDashboardStore.getState()
    store.setConfig(makeConfig('local'))
    store.markDirty()
    useDashboardStore.getState().loadFromDeviceOrDemo(makeConfig('device'))

    useDashboardStore.getState().acceptPendingDeviceConfig()

    const state = useDashboardStore.getState()
    expect(state.config?.defaultPageId).toBe('device')
    expect(state.isDirty).toBe(false)
    expect(state.pendingDeviceConfig).toBeNull()
    expect(state.selectedPageId).toBe('device')
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
  })

  it('dismissing the staged config keeps local edits dirty', () => {
    const store = useDashboardStore.getState()
    store.setConfig(makeConfig('local'))
    store.markDirty()
    useDashboardStore.getState().loadFromDeviceOrDemo(makeConfig('device'))

    useDashboardStore.getState().dismissPendingDeviceConfig()

    const state = useDashboardStore.getState()
    expect(state.config?.defaultPageId).toBe('local')
    expect(state.isDirty).toBe(true)
    expect(state.pendingDeviceConfig).toBeNull()
  })

  it('accept is a no-op when nothing is staged', () => {
    const store = useDashboardStore.getState()
    store.setConfig(makeConfig('local'))
    store.markDirty()

    useDashboardStore.getState().acceptPendingDeviceConfig()

    const state = useDashboardStore.getState()
    expect(state.config?.defaultPageId).toBe('local')
    expect(state.isDirty).toBe(true)
  })

  it('loads the device config directly when local edits are clean', () => {
    useDashboardStore.getState().setConfig(makeConfig('local'))

    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(makeConfig('device'))

    const state = useDashboardStore.getState()
    expect(outcome).toBe('device')
    expect(state.config?.defaultPageId).toBe('device')
    expect(state.isDirty).toBe(false)
    expect(state.pendingDeviceConfig).toBeNull()
  })

  it('loads the demo config when no config exists and device has none', () => {
    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(outcome).toBe('demo')
    expect(useDashboardStore.getState().config).not.toBeNull()
    expect(useDashboardStore.getState().isDirty).toBe(false)
  })

  it('keeps the existing config when device has none', () => {
    useDashboardStore.getState().setConfig(makeConfig('local'))
    useDashboardStore.getState().markDirty()

    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(outcome).toBe('kept-edits')
    expect(useDashboardStore.getState().config?.defaultPageId).toBe('local')
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('setConfig clears a previously staged device config', () => {
    useDashboardStore.getState().setConfig(makeConfig('local'))
    useDashboardStore.getState().markDirty()
    useDashboardStore.getState().loadFromDeviceOrDemo(makeConfig('device'))

    useDashboardStore.getState().setConfig(makeConfig('fresh'))

    expect(useDashboardStore.getState().pendingDeviceConfig).toBeNull()
    expect(useDashboardStore.getState().isDirty).toBe(false)
  })
})
