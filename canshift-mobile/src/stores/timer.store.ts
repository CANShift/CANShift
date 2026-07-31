import { create } from 'zustand'
import type { TimerBleLap, TimerBleState } from '@tmbk/canshift-core'
import { insertLap, type IncomingLap, type SessionLap } from '../lib/timer-laps'

export type TimerStatus = 'idle' | 'running' | 'paused'

export const LOCAL_SESSION_ID = -1

interface TimerState {
  status: TimerStatus
  startedAt: number | null
  accumulatedMs: number
  laps: SessionLap[]
  sessionId: number | null
  deviceSynced: boolean
  start: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  reset: () => void
  captureLocalLap: (atMs?: number) => IncomingLap | null
  applyDeviceState: (state: TimerBleState, atMs?: number) => void
  applyDeviceLap: (lap: TimerBleLap) => void
  clearDeviceSync: () => void
}

const STATUS_BY_RUN_STATE: Record<TimerBleState['state'], TimerStatus> = {
  reset: 'idle',
  running: 'running',
  paused: 'paused',
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  status: 'idle',
  startedAt: null,
  accumulatedMs: 0,
  laps: [],
  sessionId: null,
  deviceSynced: false,

  start: () => {
    if (get().status !== 'idle') return
    set({
      status: 'running',
      startedAt: Date.now(),
      accumulatedMs: 0,
      laps: [],
      sessionId: LOCAL_SESSION_ID,
    })
  },

  pause: () => {
    const { status, startedAt, accumulatedMs } = get()
    if (status !== 'running' || startedAt === null) return
    set({
      status: 'paused',
      startedAt: null,
      accumulatedMs: accumulatedMs + Math.max(0, Date.now() - startedAt),
    })
  },

  resume: () => {
    if (get().status !== 'paused') return
    set({ status: 'running', startedAt: Date.now() })
  },

  toggle: () => {
    const { status, start, pause, resume } = get()
    if (status === 'idle') start()
    else if (status === 'running') pause()
    else resume()
  },

  reset: () => {
    set({ status: 'idle', startedAt: null, accumulatedMs: 0, laps: [] })
  },

  captureLocalLap: (atMs = Date.now()) => {
    const state = get()
    if (state.status !== 'running') return null
    const totalMs = elapsedMsOf(state, atMs)
    const previousTotalMs = state.laps.reduce((max, lap) => Math.max(max, lap.totalMs), 0)
    const lap: IncomingLap = {
      sessionId: state.sessionId ?? LOCAL_SESSION_ID,
      index: state.laps.length + 1,
      lapMs: Math.max(0, totalMs - previousTotalMs),
      totalMs,
    }
    set({ laps: insertLap(state.laps, lap) })
    return lap
  },

  applyDeviceState: (deviceState, atMs = Date.now()) => {
    const { sessionId, laps } = get()
    const sameSession = sessionId === deviceState.sessionId
    const keepLaps = sameSession && deviceState.lapCount > 0
    set({
      status: STATUS_BY_RUN_STATE[deviceState.state],
      accumulatedMs: deviceState.elapsedMs,
      startedAt: deviceState.state === 'running' ? atMs : null,
      sessionId: deviceState.sessionId,
      deviceSynced: true,
      laps: keepLaps ? laps : [],
    })
  },

  applyDeviceLap: (lap) => {
    const { sessionId, laps } = get()
    if (sessionId !== null && lap.sessionId !== sessionId) return
    set({
      laps: insertLap(laps, { index: lap.index, lapMs: lap.lapMs, totalMs: lap.totalMs }),
      sessionId: lap.sessionId,
    })
  },

  clearDeviceSync: () => {
    set({ deviceSynced: false })
  },
}))

export const elapsedMsOf = (
  state: Pick<TimerState, 'status' | 'startedAt' | 'accumulatedMs'>,
  atMs: number = Date.now()
): number => {
  if (state.status === 'running' && state.startedAt !== null) {
    return state.accumulatedMs + Math.max(0, atMs - state.startedAt)
  }
  return state.accumulatedMs
}
