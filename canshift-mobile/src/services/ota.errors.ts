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

const describe = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown OTA error'
}

export const mapOtaError = (err: unknown): OtaError => {
  if (err instanceof OtaServiceError) return err.cause
  return { kind: 'unknown', message: describe(err) }
}

export const describeOtaErrorForUser = (err: OtaError): string => {
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

export const describeOtaError = (err: OtaError): string => {
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

export class OtaServiceError extends Error {
  readonly cause: OtaError

  constructor(cause: OtaError) {
    super(describeOtaError(cause))
    this.name = 'OtaServiceError'
    this.cause = cause
  }
}
