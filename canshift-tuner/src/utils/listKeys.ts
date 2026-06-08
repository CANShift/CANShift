// listKeys.ts — Stable React keys for reorderable list items (R-5, issue #1288).
//
// Some persisted list items (button actions, color ramp stops) didn't carry an
// `id` field before #1288. Keying by index made React reuse DOM nodes between
// adjacent positions when an item was removed — Radix focus, native <select>
// hover, and IME composition all carried over to the wrong tenant.
//
// New items get an `id` at creation via `newId()`. Existing id-less items get
// a stable runtime-only id on first read via a WeakMap keyed on the object
// reference. Because immer keeps unrelated array entries referentially stable
// across store updates, the WeakMap key stays valid for the lifetime of the
// item — adjacent removals don't shuffle keys.
//
// The id assigned via WeakMap is NOT persisted; on the next page reload the
// store rehydrates from JSON and a fresh id is generated for the same item.
// That's intentional — the key only needs to be stable across renders within a
// single session, which is all React's reconciliation cares about.
//
// `crypto.randomUUID()` is available in every browser Studio targets (Chrome /
// Edge / Firefox / Safari 15.4+). Falls back to `Math.random()` only on the
// vanishingly rare environment without it (test runners, very old WebView).

import type { ButtonAction, ColorRampStop } from '@tmbk/canshift-core'

const actionKeys = new WeakMap<ButtonAction, string>()
const rampStopKeys = new WeakMap<ColorRampStop, string>()

let fallbackCounter = 0

/** Generate a fresh stable id for a newly created list item. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  return `id_${Date.now().toString(36)}_${fallbackCounter.toString(36)}`
}

/**
 * Stable React key for a `ButtonAction` row. Uses the action's own `id`
 * when present; otherwise pins a runtime id to the action object via a
 * WeakMap so subsequent renders return the same key for the same instance.
 */
export function actionKey(action: ButtonAction): string {
  if (action.id !== undefined) return action.id
  const existing = actionKeys.get(action)
  if (existing !== undefined) return existing
  const generated = newId()
  actionKeys.set(action, generated)
  return generated
}

/**
 * Stable React key for a `ColorRampStop` row. Same contract as `actionKey`.
 */
export function rampStopKey(stop: ColorRampStop): string {
  if (stop.id !== undefined) return stop.id
  const existing = rampStopKeys.get(stop)
  if (existing !== undefined) return existing
  const generated = newId()
  rampStopKeys.set(stop, generated)
  return generated
}
