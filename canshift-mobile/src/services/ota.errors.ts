// ota.errors.ts — Discriminated OTA error union and mapping helper
//
// The OTA flow has several distinct failure modes (release listing, asset
// download, checksum verification, multipart upload to the device, network
// drops mid-transfer, device-side rejection). Surfacing them as a typed
// discriminated union lets the UI render actionable copy and lets the service
// layer fail loud at the right boundary.
//
// Tests live next to this file; consumers (UI + service) import the union and
// the `mapOtaError` / `describeOtaErrorForUser` helpers.

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * UI-facing classification of an OTA failure. The shape is stable across
 * platforms; each variant carries just enough context for the UI to render
 * actionable, copy-ready guidance.
 */
export type OtaError =
  | { kind: 'releases-fetch-failed'; status?: number }
  | { kind: 'no-binary-asset'; version: string }
  | { kind: 'download-failed'; reason: string }
  | { kind: 'size-mismatch'; expected: number; actual: number }
  | { kind: 'checksum-mismatch'; expected: string; actual: string }
  | { kind: 'hmac-prepare-failed'; reason: string }
  | { kind: 'network-dropped' }
  | { kind: 'device-unreachable' }
  | { kind: 'device-rejected'; status: number }
  | { kind: 'unknown'; message: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Best-effort string for the `unknown` fallback. Avoids leaking objects. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown OTA error'
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Map any thrown value from an OTA call into an `OtaError`. Service-layer
 * callers throw `OtaServiceError` (below) with a typed `cause`; this helper
 * unwraps that and falls back to `{ kind: 'unknown' }` for anything else.
 */
export function mapOtaError(err: unknown): OtaError {
  if (err instanceof OtaServiceError) return err.cause
  return { kind: 'unknown', message: describe(err) }
}

/**
 * User-facing copy for an `OtaError`. Keep this aligned with what the
 * `UpdateScreen` shows in its error banner. Lines focus on the *next action*
 * the user can take, not on internal jargon.
 */
export function describeOtaErrorForUser(err: OtaError): string {
  switch (err.kind) {
    case 'releases-fetch-failed':
      return err.status !== undefined
        ? `Could not load releases (HTTP ${String(err.status)}). Check your internet connection.`
        : 'Could not load releases. Check your internet connection.'
    case 'no-binary-asset':
      return `Release ${err.version} has no firmware binary attached.`
    case 'download-failed':
      return `Firmware download failed: ${err.reason}.`
    case 'size-mismatch':
      return `Firmware size mismatch (expected ${String(err.expected)} bytes, got ${String(err.actual)}). The download may be corrupted — try again.`
    case 'checksum-mismatch':
      return 'Firmware checksum mismatch. The downloaded file does not match the published release — try again, or report this if it persists.'
    case 'hmac-prepare-failed':
      return `Could not prepare the firmware for signed upload: ${err.reason}. Free up storage space and try again.`
    case 'network-dropped':
      return 'Network dropped during transfer. Reconnect to the canshift-XXXX Wi-Fi network and retry.'
    case 'device-unreachable':
      return 'Could not reach the dashboard. Make sure the dash is on and your phone is connected to the canshift-XXXX Wi-Fi network.'
    case 'device-rejected':
      return `Dashboard rejected the firmware (HTTP ${String(err.status)}). Try again, or pick a different release.`
    case 'unknown':
      return `Update failed: ${err.message}.`
    default: {
      const _exhaustive: never = err
      return _exhaustive
    }
  }
}

/**
 * Compact, log-friendly description of an `OtaError`. Screens render their
 * own user-facing messages off `err.kind`; this is for `log('error', …)`
 * and similar diagnostics.
 */
export function describeOtaError(err: OtaError): string {
  switch (err.kind) {
    case 'releases-fetch-failed':
      return `releases fetch failed${err.status !== undefined ? ` (HTTP ${String(err.status)})` : ''}`
    case 'no-binary-asset':
      return `no .bin asset for ${err.version}`
    case 'download-failed':
      return `download failed: ${err.reason}`
    case 'size-mismatch':
      return `size mismatch (expected ${String(err.expected)}, got ${String(err.actual)})`
    case 'checksum-mismatch':
      return `checksum mismatch (expected ${err.expected}, got ${err.actual})`
    case 'hmac-prepare-failed':
      return `hmac prepare failed: ${err.reason}`
    case 'network-dropped':
      return 'network dropped'
    case 'device-unreachable':
      return 'device unreachable'
    case 'device-rejected':
      return `device rejected (HTTP ${String(err.status)})`
    case 'unknown':
      return err.message
    default: {
      const _exhaustive: never = err
      return _exhaustive
    }
  }
}

// ---------------------------------------------------------------------------
// Service-layer error wrapper
// ---------------------------------------------------------------------------

/**
 * Thrown by the OTA service so callers (screens, tests) can `instanceof`-
 * detect a typed failure and recover the discriminated cause via `mapOtaError`.
 */
export class OtaServiceError extends Error {
  readonly cause: OtaError

  constructor(cause: OtaError) {
    super(describeOtaError(cause))
    this.name = 'OtaServiceError'
    this.cause = cause
  }
}
