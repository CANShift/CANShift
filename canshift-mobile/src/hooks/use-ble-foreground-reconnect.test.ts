// use-ble-foreground-reconnect.test.ts — covers the AppState→reconnect bridge
//
// We test `handleAppStateTransition` directly: it captures the whole decision
// graph (which transitions trigger, which states block, what the toast shows)
// without dragging in the React lifecycle.

// react-native-ble-plx instantiates a NativeEventEmitter at module load — the
// jest-expo runtime can't satisfy that, so we stub it out here.
jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    state: jest.fn(),
    destroy: jest.fn(),
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
  })),
  State: { PoweredOn: 'PoweredOn' },
}))

import { handleAppStateTransition } from './use-ble-foreground-reconnect'
import type { ConnectionState } from '../stores/device.store'

interface MakeDepsOverrides {
  tryReconnect?: () => Promise<boolean>
  connectionState?: ConnectionState
  isReconnecting?: boolean
}

interface ToastParams {
  type: 'info'
  text1: string
  text2?: string
}

function makeDeps(overrides: MakeDepsOverrides = {}) {
  const tryReconnect: () => Promise<boolean> =
    overrides.tryReconnect ?? (() => Promise.resolve(true))
  const noopToast = (_params: ToastParams): void => undefined
  return {
    tryReconnect: jest.fn(tryReconnect),
    showToast: jest.fn(noopToast),
    getConnectionState: jest.fn(
      (): ConnectionState => overrides.connectionState ?? 'idle',
    ),
    getIsReconnecting: jest.fn((): boolean => overrides.isReconnecting ?? false),
    appState: {
      addEventListener: jest.fn(),
      currentState: 'active' as const,
    },
  }
}

describe('handleAppStateTransition', () => {
  it('triggers reconnect on background → active when idle and last device exists', async () => {
    const deps = makeDeps()
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).toHaveBeenCalledTimes(1)
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info', text1: 'Reconnecting' }),
    )
  })

  it('triggers reconnect on inactive → active (iOS Control Center / interruption)', async () => {
    const deps = makeDeps()
    await handleAppStateTransition('inactive', 'active', deps)
    expect(deps.tryReconnect).toHaveBeenCalledTimes(1)
  })

  it('does nothing on active → background (going away)', async () => {
    const deps = makeDeps()
    await handleAppStateTransition('active', 'background', deps)
    expect(deps.tryReconnect).not.toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('does nothing on active → active (no transition into foreground)', async () => {
    const deps = makeDeps()
    await handleAppStateTransition('active', 'active', deps)
    expect(deps.tryReconnect).not.toHaveBeenCalled()
  })

  it('does not reconnect while already connected', async () => {
    const deps = makeDeps({ connectionState: 'connected' })
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).not.toHaveBeenCalled()
  })

  it('does not reconnect while connecting', async () => {
    const deps = makeDeps({ connectionState: 'connecting' })
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).not.toHaveBeenCalled()
  })

  it('does not reconnect while a reconnect loop is already running', async () => {
    const deps = makeDeps({ isReconnecting: true })
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).not.toHaveBeenCalled()
  })

  it('reconnects from the error state (user can retry by foregrounding)', async () => {
    const deps = makeDeps({ connectionState: 'error' })
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).toHaveBeenCalledTimes(1)
  })

  it('skips the toast if no last-known device is persisted', async () => {
    const deps = makeDeps({ tryReconnect: () => Promise.resolve(false) })
    await handleAppStateTransition('background', 'active', deps)
    expect(deps.tryReconnect).toHaveBeenCalledTimes(1)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('swallows tryReconnect errors and never shows a toast', async () => {
    const deps = makeDeps({
      tryReconnect: () => Promise.reject(new Error('boom')),
    })
    await expect(
      handleAppStateTransition('background', 'active', deps),
    ).resolves.toBeUndefined()
    expect(deps.showToast).not.toHaveBeenCalled()
  })
})
