// sdState.ts — Helpers for the runtime SD-card state reported by CMD_GET_STATUS.
//
// Centralises the policy: which states allow persistent writes, which surface
// a warning, and what user-facing copy each state carries. Keeping all three
// pieces of UX co-located avoids drift between the TopBar disabled tooltip
// and the ConnectModal warning text (issue #252).

import type { SdRuntimeState } from '../services/ipc.service'

/**
 * `true` when the device's SD-card state allows persistent writes.
 * - 'ok'      — writes work normally.
 * - 'unknown' — older firmware that doesn't advertise the field; allow writes
 *               so we don't regress. The firmware will surface its own error
 *               if SD is actually missing.
 * - 'no_card' / 'mount_failed' — block destructive actions, surface a warning.
 */
export function isSdWritable(state: SdRuntimeState): boolean {
  return state === 'ok' || state === 'unknown'
}

/**
 * Human-readable warning text for a degraded SD state. Returns `null` when
 * the state allows writes (callers should hide the warning entirely in that
 * case rather than rendering an empty string).
 */
export function sdStateWarning(state: SdRuntimeState): string | null {
  switch (state) {
    case 'no_card':
      return 'No SD card. Config writes will fail.'
    case 'mount_failed':
      return 'SD detected but mount failed. Config writes will fail.'
    case 'ok':
    case 'unknown':
      return null
  }
}

/**
 * Tooltip copy for the disabled "Burn" button. Slightly more actionable than
 * the indicator label so users know what to do next.
 */
export function sdBurnDisabledTooltip(state: SdRuntimeState): string | null {
  switch (state) {
    case 'no_card':
      return 'Insert an SD card and reboot the device — burn writes the config to /config/dashboard.json.'
    case 'mount_failed':
      return 'Device reports SD mount failure. Re-seat or reformat the card and reboot before burning.'
    case 'ok':
    case 'unknown':
      return null
  }
}
