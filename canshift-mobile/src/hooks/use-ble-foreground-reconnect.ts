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

// Stable default so the no-arg call site (App.tsx) keeps a single deps identity
// across renders; otherwise `deps = {}` would alloc a fresh object each render
// and re-bind the AppState listener mid-flight.
const DEFAULT_DEPS: BleForegroundReconnectDeps = Object.freeze({})

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
 *
 * Memoization contract: callers passing a `deps` argument MUST memoize the
 * object itself (e.g. with `useMemo`) — the hook keys its internal memo on the
 * `deps` object identity. A fresh `{}` every render would cleanup-then-
 * resubscribe the AppState listener on every render and could drop a
 * background→active transition mid-rebind. The no-arg form is safe; it uses a
 * frozen module-level default.
 */
export function useBleForegroundReconnect(deps: BleForegroundReconnectDeps = DEFAULT_DEPS): void {
  // Re-resolve only when the deps object identity changes. The JSDoc above
  // requires callers to memoize that object, so this is a single stable key
  // instead of five separate field identities.
  const resolved = useMemo(() => resolveDeps(deps), [deps])
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
