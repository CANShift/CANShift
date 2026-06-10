import { log } from '../stores/log.store'

const COLD_START_TARGET_MS = 2000

let appLaunchMs: number | null = null
let firstScreenMarked = false

export const markAppLaunch = (): void => {
  appLaunchMs = Date.now()
}

export const markFirstScreenReady = (): void => {
  if (firstScreenMarked) return
  firstScreenMarked = true
  if (appLaunchMs === null) {
    log('warn', 'cold-start: markFirstScreenReady before markAppLaunch')
    return
  }
  const elapsed = Date.now() - appLaunchMs
  const status = elapsed <= COLD_START_TARGET_MS ? 'ok' : 'slow'
  log(
    'info',
    `cold-start: ${String(elapsed)}ms (target ${String(COLD_START_TARGET_MS)}ms, ${status})`
  )
}

export const _resetForTests = (): void => {
  appLaunchMs = null
  firstScreenMarked = false
}
