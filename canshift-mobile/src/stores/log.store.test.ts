// log.store.test.ts — Tests for the log ring buffer store

import { useLogStore } from './log.store'

describe('useLogStore', () => {
  beforeEach(() => {
    useLogStore.getState().clear()
  })

  it('records new entries at the head with level and message', () => {
    useLogStore.getState().log('info', 'first')
    useLogStore.getState().log('warn', 'second')
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ level: 'warn', message: 'second' })
    expect(entries[1]).toMatchObject({ level: 'info', message: 'first' })
  })

  it('caps retention at 200 entries, evicting the oldest', () => {
    for (let i = 0; i < 250; i += 1) {
      useLogStore.getState().log('info', `msg-${String(i)}`)
    }
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(200)
    expect(entries[0]?.message).toBe('msg-249')
    expect(entries[199]?.message).toBe('msg-50')
  })

  it('clear() empties the buffer', () => {
    useLogStore.getState().log('error', 'boom')
    expect(useLogStore.getState().entries).toHaveLength(1)
    useLogStore.getState().clear()
    expect(useLogStore.getState().entries).toEqual([])
  })
})
