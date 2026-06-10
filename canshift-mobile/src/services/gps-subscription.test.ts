import { clearAll, getSampleAt, getWriteIndex } from '../stores/track-session.store'
import { startGpsSubscription, type GpsWatcher, type GpsWatcherUpdate } from './gps-subscription'

const makeWatcher = (): {
  watcher: GpsWatcher
  emit: (update: GpsWatcherUpdate) => void
  detached: () => boolean
} => {
  let listener: ((update: GpsWatcherUpdate) => void) | null = null
  let wasDetached = false
  return {
    watcher: {
      start(onUpdate) {
        listener = onUpdate
        return Promise.resolve(() => {
          wasDetached = true
        })
      },
    },
    emit(update) {
      if (listener) listener(update)
    },
    detached: () => wasDetached,
  }
}

describe('startGpsSubscription', () => {
  beforeEach(() => {
    clearAll()
  })

  it('pushes each watcher update into the track-session store as a GpsSample', async () => {
    const { watcher, emit } = makeWatcher()
    await startGpsSubscription(watcher)

    emit({ t: 1000, lat: 46.2, lng: 6.1, speedMs: 12.5, headingDeg: 180 })
    emit({ t: 1200, lat: 46.21, lng: 6.11, speedMs: 13.0, headingDeg: 178 })

    expect(getWriteIndex()).toBe(2)
    expect(getSampleAt(0)).toEqual({
      t: 1000,
      lat: 46.2,
      lng: 6.1,
      speedMs: 12.5,
      headingDeg: 180,
    })
    expect(getSampleAt(1)).toEqual({
      t: 1200,
      lat: 46.21,
      lng: 6.11,
      speedMs: 13.0,
      headingDeg: 178,
    })
  })

  it('maps null speed and heading to 0', async () => {
    const { watcher, emit } = makeWatcher()
    await startGpsSubscription(watcher)

    emit({ t: 5000, lat: 0, lng: 0, speedMs: null, headingDeg: null })

    expect(getSampleAt(0)).toEqual({ t: 5000, lat: 0, lng: 0, speedMs: 0, headingDeg: 0 })
  })

  it('stop() detaches the watcher and is idempotent', async () => {
    const { watcher, detached } = makeWatcher()
    const sub = await startGpsSubscription(watcher)

    expect(detached()).toBe(false)
    sub.stop()
    expect(detached()).toBe(true)
    sub.stop()
    expect(detached()).toBe(true)
  })

  it('propagates watcher start() rejection', async () => {
    const failing: GpsWatcher = {
      start: () => Promise.reject(new Error('permission denied')),
    }
    await expect(startGpsSubscription(failing)).rejects.toThrow('permission denied')
  })
})
