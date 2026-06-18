import type { DashboardConfig } from '@tmbk/canshift-core'
import { canonicalStringify } from '../lib/canonical-json'
import { usbService } from '../transport'

export type VerifyResult =
  | { kind: 'ok' }
  | { kind: 'no_reboot' }
  | { kind: 'fetch_failed'; error: string }
  | { kind: 'mismatch' }

const REBOOT_GRACE_MS = 1_500
const POLL_INTERVAL_MS = 500
const PING_TIMEOUT_MS = 500

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const pollUntilAlive = async (maxWaitMs: number): Promise<boolean> => {
  await sleep(REBOOT_GRACE_MS)
  const deadline = Date.now() + maxWaitMs - REBOOT_GRACE_MS
  while (Date.now() < deadline) {
    const result = await usbService.ping(PING_TIMEOUT_MS)
    if (result.kind === 'ok') return true
    await sleep(POLL_INTERVAL_MS)
  }
  return false
}

export const verifyBurnedConfig = async (
  expected: DashboardConfig,
  maxWaitMs = 10_000
): Promise<VerifyResult> => {
  const alive = await pollUntilAlive(maxWaitMs)
  if (!alive) return { kind: 'no_reboot' }

  const fetched = await usbService.getConfig()
  if (fetched.kind === 'error') return { kind: 'fetch_failed', error: fetched.error }

  if (canonicalStringify(fetched.config) !== canonicalStringify(expected)) {
    return { kind: 'mismatch' }
  }
  return { kind: 'ok' }
}
