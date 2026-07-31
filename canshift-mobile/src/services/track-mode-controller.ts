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
  | { started: false; reason: 'permission_denied' | 'gps_unavailable' | 'cancelled' }

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
  let startPromise: Promise<TrackModeStartResult> | null = null
  let generation = 0

  const doStart = async (gen: number): Promise<TrackModeStartResult> => {
    const permission = await requestPermission()
    if (gen !== generation) return { started: false, reason: 'cancelled' }
    if (!permission.granted) return { started: false, reason: 'permission_denied' }
    let nextSubscription: GpsSubscription
    try {
      nextSubscription = await startGpsSubscription(watcher)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      log('warn', `Track mode: GPS watcher failed to start — ${detail}`)
      return { started: false, reason: 'gps_unavailable' }
    }
    if (gen !== generation) {
      nextSubscription.stop()
      return { started: false, reason: 'cancelled' }
    }
    try {
      startSession()
      publisher.start()
    } catch (err) {
      nextSubscription.stop()
      stopSession()
      throw err
    }
    subscription = nextSubscription
    log('info', 'Track mode started')
    return { started: true }
  }

  const start = (): Promise<TrackModeStartResult> => {
    if (subscription !== null) return Promise.resolve({ started: true })
    startPromise ??= doStart(generation).finally(() => {
      startPromise = null
    })
    return startPromise
  }

  const stop = async (): Promise<void> => {
    generation += 1
    if (startPromise !== null) await startPromise.catch(() => undefined)
    if (subscription === null) return
    subscription.stop()
    subscription = null
    try {
      stopSession()
    } finally {
      publisher.stop()
      await publisher.tickNow()
    }
    log('info', 'Track mode stopped')
  }

  const isActive = (): boolean => subscription !== null

  return { start, stop, isActive }
}

export const trackModeController = createTrackModeController()
