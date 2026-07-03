import { create } from 'zustand'

export type TimerStatus = 'idle' | 'running' | 'paused'

interface TimerState {
  status: TimerStatus
  startedAt: number | null
  accumulatedMs: number
  start: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  reset: () => void
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  status: 'idle',
  startedAt: null,
  accumulatedMs: 0,

  start: () => {
    if (get().status !== 'idle') return
    set({ status: 'running', startedAt: Date.now(), accumulatedMs: 0 })
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
    set({ status: 'idle', startedAt: null, accumulatedMs: 0 })
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
