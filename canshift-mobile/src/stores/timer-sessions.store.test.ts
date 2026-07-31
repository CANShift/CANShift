import {
  MAX_STORED_SESSIONS,
  clearTimerSessions,
  hydrateTimerSessions,
  recordSessionLap,
  setTimerSessionStorage,
  useTimerSessionsStore,
} from './timer-sessions.store'
import type { StoredTimerSession, TimerSessionStorage } from '../services/timer-session-storage'

const createMemoryStorage = (initial: StoredTimerSession[] = []) => {
  let stored: StoredTimerSession[] = initial
  const storage: TimerSessionStorage = {
    load: () => Promise.resolve(stored),
    save: (sessions) => {
      stored = [...sessions]
      return Promise.resolve()
    },
  }
  return { storage, snapshot: () => stored }
}

const initialState = useTimerSessionsStore.getState()

describe('timer sessions store', () => {
  beforeEach(() => {
    useTimerSessionsStore.setState(initialState, true)
  })

  it('hydrates from storage once', async () => {
    const persisted: StoredTimerSession[] = [
      { key: 's-1-1', startedAt: 100, laps: [{ index: 1, lapMs: 900, totalMs: 900 }] },
    ]
    const { storage } = createMemoryStorage(persisted)
    setTimerSessionStorage(storage)

    await hydrateTimerSessions()
    expect(useTimerSessionsStore.getState().sessions).toEqual(persisted)

    setTimerSessionStorage(createMemoryStorage([]).storage)
    await hydrateTimerSessions()
    expect(useTimerSessionsStore.getState().sessions).toEqual(persisted)
  })

  it('merges laps recorded before hydration with stored history', async () => {
    const persisted: StoredTimerSession[] = [
      { key: 'old', startedAt: 1, laps: [{ index: 1, lapMs: 500, totalMs: 500 }] },
    ]
    const { storage, snapshot } = createMemoryStorage(persisted)
    setTimerSessionStorage(storage)

    recordSessionLap({ sessionId: 1, index: 1, lapMs: 1000, totalMs: 1000 })
    await hydrateTimerSessions()

    const sessions = useTimerSessionsStore.getState().sessions
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.key).toBe('old')
    expect(snapshot()).toEqual(sessions)
  })

  it('opens a session bucket on the first lap and appends subsequent laps', async () => {
    const { storage, snapshot } = createMemoryStorage()
    setTimerSessionStorage(storage)
    await hydrateTimerSessions()

    recordSessionLap({ sessionId: 1, index: 1, lapMs: 60000, totalMs: 60000 }, 100000)
    recordSessionLap({ sessionId: 1, index: 2, lapMs: 40000, totalMs: 100000 }, 140000)

    const sessions = useTimerSessionsStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.startedAt).toBe(40000)
    expect(sessions[0]?.laps.map((l) => l.index)).toEqual([1, 2])
    expect(snapshot()).toEqual(sessions)
  })

  it('splits buckets when a new device session starts', () => {
    setTimerSessionStorage(createMemoryStorage().storage)

    recordSessionLap({ sessionId: 1, index: 1, lapMs: 1000, totalMs: 1000 })
    recordSessionLap({ sessionId: 2, index: 1, lapMs: 2000, totalMs: 2000 })

    expect(useTimerSessionsStore.getState().sessions).toHaveLength(2)
  })

  it('dedupes buffered laps replayed after a reconnect', () => {
    setTimerSessionStorage(createMemoryStorage().storage)

    recordSessionLap({ sessionId: 1, index: 1, lapMs: 1000, totalMs: 1000 })
    recordSessionLap({ sessionId: 1, index: 2, lapMs: 1000, totalMs: 2000 })
    recordSessionLap({ sessionId: 1, index: 2, lapMs: 1000, totalMs: 2000 })

    const sessions = useTimerSessionsStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.laps).toHaveLength(2)
  })

  it('caps stored sessions at the maximum', () => {
    setTimerSessionStorage(createMemoryStorage().storage)

    for (let i = 1; i <= MAX_STORED_SESSIONS + 5; i += 1) {
      recordSessionLap({ sessionId: i, index: 1, lapMs: 1000, totalMs: 1000 })
    }
    expect(useTimerSessionsStore.getState().sessions).toHaveLength(MAX_STORED_SESSIONS)
  })

  it('clearTimerSessions wipes state and storage', () => {
    const { storage, snapshot } = createMemoryStorage()
    setTimerSessionStorage(storage)

    recordSessionLap({ sessionId: 1, index: 1, lapMs: 1000, totalMs: 1000 })
    clearTimerSessions()

    expect(useTimerSessionsStore.getState().sessions).toEqual([])
    expect(snapshot()).toEqual([])
  })
})
