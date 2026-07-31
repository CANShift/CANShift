import type { TrackTelemetry } from '@tmbk/canshift-core'
import { startGpsSubscription, type GpsSubscription, type GpsWatcher } from './gps-subscription'
import {
  expoLocationWatcher,
  requestForegroundLocationPermission,
  type ForegroundPermissionResult,
} from './gps-watcher.expo'
import {
  createTrackTelemetryPublisher,
  type TrackTelemetryWriter,
} from './track-telemetry-publisher'
import { sendCmd, type CmdPayload } from './ble.service'
import { useDeviceStore } from '../stores/device.store'
import { startSession, stopSession } from '../stores/track-session.store'
import { log } from '../stores/log.store'

export type TrackModeStartResult =
  | { started: true }
  | { started: false; reason: 'permission_denied' | 'gps_unavailable' }

export interface TrackModeControllerDeps {
  watcher?: GpsWatcher
  requestPermission?: () => Promise<ForegroundPermissionResult>
  write?: TrackTelemetryWriter
  publisherIntervalMs?: number
  now?: () => number
}

export interface TrackModeController {
  start(): Promise<TrackModeStartResult>
  stop(): Promise<void>
  isActive(): boolean
}

export const toTrackStateCmd = (telemetry: TrackTelemetry): CmdPayload => {
  const payload: CmdPayload = { trackMode: telemetry.trackMode }
  if (telemetry.currentLapMs !== undefined) payload.currentLapMs = telemetry.currentLapMs
  if (telemetry.lastLapMs !== undefined) payload.lastLapMs = telemetry.lastLapMs
  if (telemetry.bestLapMs !== undefined) payload.bestLapMs = telemetry.bestLapMs
  if (telemetry.lapNumber !== undefined) payload.lapNumber = telemetry.lapNumber
  if (telemetry.deltaMs !== undefined) payload.deltaMs = telemetry.deltaMs
  if (telemetry.isBestLap !== undefined) payload.isBestLap = telemetry.isBestLap
  return payload
}

const writeTrackStateOverBle: TrackTelemetryWriter = async (telemetry) => {
  const { connectionState, mode } = useDeviceStore.getState()
  if (connectionState !== 'connected' || mode !== 'ble') return
  await sendCmd('track_state', toTrackStateCmd(telemetry))
}

export const createTrackModeController = (
  deps: TrackModeControllerDeps = {}
): TrackModeController => {
  const watcher = deps.watcher ?? expoLocationWatcher
  const requestPermission = deps.requestPermission ?? requestForegroundLocationPermission
  const publisher = createTrackTelemetryPublisher({
    write: deps.write ?? writeTrackStateOverBle,
    ...(deps.publisherIntervalMs !== undefined ? { intervalMs: deps.publisherIntervalMs } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  })

  let subscription: GpsSubscription | null = null
  let starting = false

  const start = async (): Promise<TrackModeStartResult> => {
    if (subscription !== null || starting) return { started: true }
    starting = true
    try {
      const permission = await requestPermission()
      if (!permission.granted) return { started: false, reason: 'permission_denied' }
      try {
        subscription = await startGpsSubscription(watcher)
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        log('warn', `Track mode: GPS watcher failed to start — ${detail}`)
        return { started: false, reason: 'gps_unavailable' }
      }
      startSession()
      publisher.start()
      log('info', 'Track mode started')
      return { started: true }
    } finally {
      starting = false
    }
  }

  const stop = async (): Promise<void> => {
    if (subscription === null) return
    subscription.stop()
    subscription = null
    stopSession()
    publisher.stop()
    await publisher.tickNow()
    log('info', 'Track mode stopped')
  }

  const isActive = (): boolean => subscription !== null

  return { start, stop, isActive }
}

export const trackModeController = createTrackModeController()
