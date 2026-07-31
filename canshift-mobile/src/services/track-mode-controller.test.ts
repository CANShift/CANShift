import type { TrackTelemetry } from '@tmbk/canshift-core'
import { clearAll, recordLap, useTrackSessionStore } from '../stores/track-session.store'
import type { GpsWatcher, GpsWatcherUpdate } from './gps-subscription'
import { createTrackModeController, toTrackStateCmd } from './track-mode-controller'

const PUBLISH_INTERVAL_MS = 60_000

const makeWatcher = (): {
  watcher: GpsWatcher
  emit: (update: GpsWatcherUpdate) => void
  startCalls: () => number
  detached: () => boolean
} => {
  let listener: ((update: GpsWatcherUpdate) => void) | null = null
  let starts = 0
  let wasDetached = false
  return {
    watcher: {
      start(onUpdate) {
        starts += 1
        listener = onUpdate
        return Promise.resolve(() => {
          wasDetached = true
        })
      },
    },
    emit(update) {
      if (listener) listener(update)
    },
    startCalls: () => starts,
    detached: () => wasDetached,
  }
}

const makeWriter = (): {
  write: jest.Mock<Promise<void>, [TrackTelemetry]>
  payloads: TrackTelemetry[]
} => {
  const payloads: TrackTelemetry[] = []
  const write = jest.fn((payload: TrackTelemetry) => {
    payloads.push(payload)
    return Promise.resolve()
  })
  return { write, payloads }
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('toTrackStateCmd', () => {
  it('maps a minimal payload to just trackMode', () => {
    expect(toTrackStateCmd({ trackMode: false })).toEqual({ trackMode: false })
  })

  it('maps every populated field and omits absent ones', () => {
    expect(
      toTrackStateCmd({
        trackMode: true,
        currentLapMs: 12_345,
        lastLapMs: 81_000,
        bestLapMs: 79_500,
        lapNumber: 3,
        deltaMs: -250,
        isBestLap: true,
      })
    ).toEqual({
      trackMode: true,
      currentLapMs: 12_345,
      lastLapMs: 81_000,
      bestLapMs: 79_500,
      lapNumber: 3,
      deltaMs: -250,
      isBestLap: true,
    })
  })
})

describe('createTrackModeController', () => {
  beforeEach(() => {
    clearAll()
  })

  const granted = () => Promise.resolve({ granted: true as const })

  it('start() begins a session, starts the GPS watcher, and publishes trackMode=true', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write, payloads } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
      now: () => 0,
    })

    const result = await controller.start()
    await flushMicrotasks()

    expect(result).toEqual({ started: true })
    expect(controller.isActive()).toBe(true)
    expect(startCalls()).toBe(1)
    expect(useTrackSessionStore.getState().recording).toBe(true)
    expect(payloads[0]?.trackMode).toBe(true)
    await controller.stop()
  })

  it('start() feeds GPS updates into the track-session store', async () => {
    const { watcher, emit } = makeWatcher()
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    await controller.start()
    emit({ t: 1000, lat: 46.2, lng: 6.1, speedMs: 10, headingDeg: 90 })
    emit({ t: 1200, lat: 46.21, lng: 6.11, speedMs: 11, headingDeg: 92 })

    expect(useTrackSessionStore.getState().writeIndex).toBe(2)
    await controller.stop()
  })

  it('start() is idempotent while active — the watcher starts once', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    await controller.start()
    const second = await controller.start()

    expect(second).toEqual({ started: true })
    expect(startCalls()).toBe(1)
    await controller.stop()
  })

  it('start() reports permission_denied without touching the session', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: () => Promise.resolve({ granted: false, canAskAgain: true }),
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    const result = await controller.start()

    expect(result).toEqual({ started: false, reason: 'permission_denied' })
    expect(controller.isActive()).toBe(false)
    expect(useTrackSessionStore.getState().recording).toBe(false)
    expect(startCalls()).toBe(0)
    expect(write).not.toHaveBeenCalled()
  })

  it('start() reports gps_unavailable when the watcher fails to start', async () => {
    const failing: GpsWatcher = {
      start: () => Promise.reject(new Error('no location services')),
    }
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher: failing,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    const result = await controller.start()

    expect(result).toEqual({ started: false, reason: 'gps_unavailable' })
    expect(controller.isActive()).toBe(false)
    expect(useTrackSessionStore.getState().recording).toBe(false)
  })

  it('stop() detaches the watcher, ends the session, and publishes trackMode=false', async () => {
    const { watcher, detached } = makeWatcher()
    const { write, payloads } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
      now: () => 0,
    })

    await controller.start()
    recordLap(0, 90_000)
    await controller.stop()

    expect(controller.isActive()).toBe(false)
    expect(detached()).toBe(true)
    expect(useTrackSessionStore.getState().recording).toBe(false)
    expect(useTrackSessionStore.getState().laps).toHaveLength(1)
    expect(payloads.at(-1)).toEqual({ trackMode: false })
  })

  it('stop() before start() is a no-op', async () => {
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher: makeWatcher().watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    await expect(controller.stop()).resolves.toBeUndefined()
    expect(write).not.toHaveBeenCalled()
  })

  it('restarts cleanly after a stop', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write, payloads } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
      now: () => 0,
    })

    await controller.start()
    await controller.stop()
    const result = await controller.start()
    await flushMicrotasks()

    expect(result).toEqual({ started: true })
    expect(startCalls()).toBe(2)
    expect(payloads.at(-1)?.trackMode).toBe(true)
    await controller.stop()
  })

  it('stop() during a pending permission request cancels the start', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write } = makeWriter()
    let grantPermission: (result: { granted: true }) => void = () => undefined
    const controller = createTrackModeController({
      watcher,
      requestPermission: () =>
        new Promise((resolve) => {
          grantPermission = resolve
        }),
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    const startResult = controller.start()
    const stopResult = controller.stop()
    grantPermission({ granted: true })

    await expect(startResult).resolves.toEqual({ started: false, reason: 'cancelled' })
    await stopResult
    expect(controller.isActive()).toBe(false)
    expect(startCalls()).toBe(0)
    expect(useTrackSessionStore.getState().recording).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('stop() during a pending GPS watcher start detaches the late subscription', async () => {
    let detached = false
    let attachWatcher: (detach: () => void) => void = () => undefined
    const watcher: GpsWatcher = {
      start: () =>
        new Promise((resolve) => {
          attachWatcher = resolve
        }),
    }
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    const startResult = controller.start()
    await flushMicrotasks()
    const stopResult = controller.stop()
    attachWatcher(() => {
      detached = true
    })

    await expect(startResult).resolves.toEqual({ started: false, reason: 'cancelled' })
    await stopResult
    expect(controller.isActive()).toBe(false)
    expect(detached).toBe(true)
    expect(useTrackSessionStore.getState().recording).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('concurrent start() calls share one attempt and one watcher start', async () => {
    const { watcher, startCalls } = makeWatcher()
    const { write } = makeWriter()
    const controller = createTrackModeController({
      watcher,
      requestPermission: granted,
      write,
      publisherIntervalMs: PUBLISH_INTERVAL_MS,
    })

    const [first, second] = await Promise.all([controller.start(), controller.start()])

    expect(first).toEqual({ started: true })
    expect(second).toEqual({ started: true })
    expect(startCalls()).toBe(1)
    await controller.stop()
  })
})
