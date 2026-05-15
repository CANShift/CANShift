// use-ble-foreground-reconnect.ts — auto-reconnect BLE on app foreground
//
// iOS suspends the JS runtime when the app is backgrounded, which freezes the
// in-flight reconnect loop. When the user brings the app back to the
// foreground, this hook detects the background→active transition and asks the
// BLE service to retry against the last-known device — but only if we're not
// already connected/connecting and the user didn't explicitly disconnect.

import { useEffect, useMemo, useRef } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import { useDeviceStore, type ConnectionState } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import { tryReconnectLastDevice } from '../services/ble.service'
import { Toast } from '../components/ui'
import { log } from '../stores/log.store'

/** A connection state from which it makes sense to attempt a reconnect. */
function isReconnectable(state: ConnectionState): boolean {
  return state === 'idle' || state === 'error'
}

/** App states that count as "the OS suspended us" — coming back from any of
 *  these to `active` is the trigger we care about. */
function isBackgrounded(state: AppStateStatus): boolean {
  return state === 'background' || state === 'inactive'
}

/**
 * Dependencies the hook needs from the world. Defaulted to the production
 * wiring; tests inject stubs.
 */
export interface BleForegroundReconnectDeps {
  appState?: Pick<typeof AppState, 'addEventListener' | 'currentState'>
  tryReconnect?: () => Promise<boolean>
  showToast?: (params: { type: 'info'; text1: string; text2?: string }) => void
  getConnectionState?: () => ConnectionState
  getIsReconnecting?: () => boolean
}

interface ResolvedDeps {
  appState: Pick<typeof AppState, 'addEventListener' | 'currentState'>
  tryReconnect: () => Promise<boolean>
  showToast: (params: { type: 'info'; text1: string; text2?: string }) => void
  getConnectionState: () => ConnectionState
  getIsReconnecting: () => boolean
}

function resolveDeps(deps: BleForegroundReconnectDeps): ResolvedDeps {
  return {
    appState: deps.appState ?? AppState,
    tryReconnect: deps.tryReconnect ?? tryReconnectLastDevice,
    showToast:
      deps.showToast ??
      ((params) => {
        Toast.show(params)
      }),
    getConnectionState:
      deps.getConnectionState ?? (() => useDeviceStore.getState().connectionState),
    getIsReconnecting:
      deps.getIsReconnecting ?? (() => useReconnectStore.getState().isReconnecting),
  }
}

/**
 * Pure side-effect: handle a single AppState transition. Exported so tests can
 * exercise the decision logic without the React lifecycle.
 */
export async function handleAppStateTransition(
  prev: AppStateStatus,
  next: AppStateStatus,
  deps: ResolvedDeps
): Promise<void> {
  // We only care about coming BACK to the foreground from background/inactive.
  if (next !== 'active' || !isBackgrounded(prev)) return

  // Don't fight ongoing connect attempts or an already-running reconnect loop.
  if (deps.getIsReconnecting()) return
  if (!isReconnectable(deps.getConnectionState())) return

  let started = false
  try {
    started = await deps.tryReconnect()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Foreground reconnect attempt failed: ${msg}`)
    return
  }

  if (started) {
    deps.showToast({
      type: 'info',
      text1: 'Reconnecting',
      text2: 'Trying to reach your dashboard…',
    })
  }
}

/**
 * Wire up an AppState listener that triggers a BLE auto-reconnect against the
 * last-known device whenever the app returns to the foreground.
 *
 * Mount once at the top of the tree (e.g. in `App.tsx`).
 */
export function useBleForegroundReconnect(deps: BleForegroundReconnectDeps = {}): void {
  // Re-resolve when any concrete dependency identity changes. `useRef` was the
  // original implementation but it captured the deps only on first render,
  // which silently ignored later updates from tests (or any future caller
  // passing live deps). useMemo keys on the dep identities so re-mounts /
  // identity changes correctly rebind the listeners.
  const resolved = useMemo(
    () => resolveDeps(deps),
    [
      deps.appState,
      deps.tryReconnect,
      deps.showToast,
      deps.getConnectionState,
      deps.getIsReconnecting,
    ]
  )
  const lastStateRef = useRef<AppStateStatus>(resolved.appState.currentState)

  useEffect(() => {
    const subscription: NativeEventSubscription = resolved.appState.addEventListener(
      'change',
      (next) => {
        const prev = lastStateRef.current
        lastStateRef.current = next
        void handleAppStateTransition(prev, next, resolved)
      }
    )

    return () => {
      subscription.remove()
    }
  }, [resolved])
}
