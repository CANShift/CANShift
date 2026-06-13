import type { ButtonAction, ColorRampStop } from '@tmbk/canshift-core'

const actionKeys = new WeakMap<ButtonAction, string>()
const rampStopKeys = new WeakMap<ColorRampStop, string>()

let fallbackCounter = 0

export const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  return `id_${Date.now().toString(36)}_${fallbackCounter.toString(36)}`
}

const memoizedKey = <T extends object>(cache: WeakMap<T, string>, item: T): string => {
  const existing = cache.get(item)
  if (existing !== undefined) return existing
  const generated = newId()
  cache.set(item, generated)
  return generated
}

export const actionKey = (action: ButtonAction): string =>
  action.id ?? memoizedKey(actionKeys, action)

export const rampStopKey = (stop: ColorRampStop): string =>
  stop.id ?? memoizedKey(rampStopKeys, stop)
