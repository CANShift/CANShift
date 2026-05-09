// cold-start.ts — Lightweight cold-start timing instrumentation.
//
// Goal: surface the wall-clock delta between JS bundle entry and the first
// usable screen render so regressions show up in the Console tab + Metro logs.
//
// Target: <2000 ms on a real iPhone 13 cold launch (issue #159).
//
// No native dependency: the JS engine is already running by the time
// `markAppLaunch()` is called, so this measures the JS-visible portion of
// startup (parse + bundle eval + first render). It does not capture native
// init time before JS starts — for that we'd need `react-native-performance`,
// tracked separately as a follow-up.

import { log } from '../stores/log.store'

const COLD_START_TARGET_MS = 2000

let appLaunchMs: number | null = null
let firstScreenMarked = false

/** Called from `index.ts` as the very first JS work after bundle eval. */
export function markAppLaunch(): void {
  appLaunchMs = Date.now()
}

/**
 * Called once after the first usable screen has rendered.
 * Subsequent calls are ignored so re-mounts (navigation, fast refresh) don't
 * pollute the metric.
 */
export function markFirstScreenReady(): void {
  if (firstScreenMarked) return
  firstScreenMarked = true
  if (appLaunchMs === null) {
    log('warn', 'cold-start: markFirstScreenReady before markAppLaunch')
    return
  }
  const elapsed = Date.now() - appLaunchMs
  const status = elapsed <= COLD_START_TARGET_MS ? 'ok' : 'slow'
  log('info', `cold-start: ${String(elapsed)}ms (target ${String(COLD_START_TARGET_MS)}ms, ${status})`)
}

/** Test hook — resets module state so unit tests don't leak across runs. */
export function _resetForTests(): void {
  appLaunchMs = null
  firstScreenMarked = false
}
