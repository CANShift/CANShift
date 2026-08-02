import { beforeEach, describe, expect, it } from 'vitest'
import { isObservabilityEnabled, useObservabilityStore } from './observability.store'

const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => {
      map.clear()
    },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k)
    },
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

describe('observability store', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage()
    useObservabilityStore.setState({ enabled: true })
  })

  it('defaults to enabled', () => {
    expect(isObservabilityEnabled()).toBe(true)
  })

  it('persists the opt-out and reflects it immediately', () => {
    useObservabilityStore.getState().setEnabled(false)
    expect(isObservabilityEnabled()).toBe(false)
    expect(localStorage.getItem('canshift.tuner.observability')).toBe('off')
  })

  it('re-enabling persists too', () => {
    useObservabilityStore.getState().setEnabled(false)
    useObservabilityStore.getState().setEnabled(true)
    expect(localStorage.getItem('canshift.tuner.observability')).toBe('on')
  })
})
