import { describe, it, expect, beforeEach } from 'vitest'
import { useLogStore, LOG_RING_CAP, type LogEntry } from './log.store'

describe('log.store ring buffer (#1704)', () => {
  beforeEach(() => {
    useLogStore.getState().clear()
  })

  it('caps entries at LOG_RING_CAP, dropping the oldest', () => {
    const push = useLogStore.getState().push
    for (let i = 0; i < LOG_RING_CAP + 10; i++) {
      push('info', `msg ${String(i)}`)
    }
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(LOG_RING_CAP)
    expect(entries[0]?.message).toBe('msg 10')
    expect(entries[entries.length - 1]?.message).toBe(`msg ${String(LOG_RING_CAP + 9)}`)
  })

  it('caps bridged entries too', () => {
    const pushFromBridge = useLogStore.getState().pushFromBridge
    for (let i = 0; i < LOG_RING_CAP + 5; i++) {
      const entry: LogEntry = {
        id: 0,
        level: 'info',
        message: `fw ${String(i)}`,
        timestamp: new Date(),
      }
      pushFromBridge(entry)
    }
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(LOG_RING_CAP)
    expect(entries[0]?.message).toBe('fw 5')
    expect(entries.every((e) => e.bridged)).toBe(true)
  })
})
