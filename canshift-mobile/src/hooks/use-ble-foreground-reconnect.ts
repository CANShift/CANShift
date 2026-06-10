import { useEffect, useMemo, useRef } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import { useDeviceStore, type ConnectionState } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import { tryReconnectLastDevice } from '../services/ble.service'
import { Toast } from '../components/ui'
import { log } from '../stores/log.store'

const isReconnectable = (state: ConnectionState): boolean => {
  return state === 'idle' || state === 'error'
}

const isBackgrounded = (state: AppStateStatus): boolean => {
  return state === 'background' || state === 'inactive'
}

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

const resolveDeps = (deps: BleForegroundReconnectDeps): ResolvedDeps => {
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

const DEFAULT_DEPS: BleForegroundReconnectDeps = Object.freeze({})

export async function handleAppStateTransition(
  prev: AppStateStatus,
  next: AppStateStatus,
  deps: ResolvedDeps
): Promise<void> {
  if (next !== 'active' || !isBackgrounded(prev)) return

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

export const useBleForegroundReconnect = (
  deps: BleForegroundReconnectDeps = DEFAULT_DEPS
): void => {
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
