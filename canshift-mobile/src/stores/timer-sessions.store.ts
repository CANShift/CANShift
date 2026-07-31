import { create } from 'zustand'
import { insertLap, startsNewBucket, type ActiveBucket, type IncomingLap } from '../lib/timer-laps'
import {
  fileTimerSessionStorage,
  type StoredTimerSession,
  type TimerSessionStorage,
} from '../services/timer-session-storage'

export const MAX_STORED_SESSIONS = 50

interface TimerSessionsState {
  hydrated: boolean
  sessions: StoredTimerSession[]
  activeKey: string | null
  activeBucket: ActiveBucket | null
}

let s_storage: TimerSessionStorage = fileTimerSessionStorage

export const setTimerSessionStorage = (storage: TimerSessionStorage): void => {
  s_storage = storage
}

export const useTimerSessionsStore = create<TimerSessionsState>()(() => ({
  hydrated: false,
  sessions: [],
  activeKey: null,
  activeBucket: null,
}))

export const hydrateTimerSessions = async (): Promise<void> => {
  if (useTimerSessionsStore.getState().hydrated) return
  const stored = await s_storage.load()
  const recordedBeforeHydration = useTimerSessionsStore.getState().sessions
  const storedKeys = new Set(recordedBeforeHydration.map((session) => session.key))
  const sessions = [
    ...stored.filter((session) => !storedKeys.has(session.key)),
    ...recordedBeforeHydration,
  ].slice(-MAX_STORED_SESSIONS)
  useTimerSessionsStore.setState({ hydrated: true, sessions })
  if (recordedBeforeHydration.length > 0) void s_storage.save(sessions)
}

export const recordSessionLap = (lap: IncomingLap, nowMs: number = Date.now()): void => {
  const state = useTimerSessionsStore.getState()
  const lapEntry = { index: lap.index, lapMs: lap.lapMs, totalMs: lap.totalMs }

  let sessions: StoredTimerSession[]
  let activeKey: string
  let lastIndex: number
  if (startsNewBucket(state.activeBucket, lap) || state.activeKey === null) {
    activeKey = `s-${String(nowMs)}-${String(lap.sessionId)}`
    const session: StoredTimerSession = {
      key: activeKey,
      startedAt: nowMs - lap.totalMs,
      laps: [lapEntry],
    }
    sessions = [...state.sessions, session].slice(-MAX_STORED_SESSIONS)
    lastIndex = lap.index
  } else {
    activeKey = state.activeKey
    sessions = state.sessions.map((session) =>
      session.key === activeKey ? { ...session, laps: insertLap(session.laps, lapEntry) } : session
    )
    lastIndex = Math.max(state.activeBucket?.lastIndex ?? 0, lap.index)
  }

  useTimerSessionsStore.setState({
    sessions,
    activeKey,
    activeBucket: { sessionId: lap.sessionId, lastIndex },
  })
  if (state.hydrated) void s_storage.save(sessions)
}

export const clearTimerSessions = (): void => {
  useTimerSessionsStore.setState({
    hydrated: true,
    sessions: [],
    activeKey: null,
    activeBucket: null,
  })
  void s_storage.save([])
}
