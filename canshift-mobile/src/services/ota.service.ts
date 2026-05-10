// ota.service.ts — Firmware release download + WiFi OTA push
//
// Failure modes are surfaced through the `OtaError` discriminated union (see
// ota.errors.ts) so the UI can render actionable copy. Network drops, size
// mismatches, checksum mismatches and device-side rejections all produce
// distinct, typed failures.
//
// Checksum strategy: GitHub Releases v3 publishes a per-asset
// `digest: "sha256:<hex>"` field on every uploaded asset. We pin that digest
// at listing time, then re-verify it after download via the pure-JS SHA-256
// implementation in `sha256.ts` (no native dep required). If a release was
// uploaded before the digest field was rolled out the digest is `null` and
// we skip checksum verification but still enforce the strict size check.

import { Buffer } from 'buffer'
import * as FileSystem from 'expo-file-system'
import {
  ESP32_OTA_URL,
  GITHUB_RELEASES_API,
  GITHUB_RELEASES_PER_PAGE,
  OTA_UPLOAD_FIELD_NAME,
  OTA_UPLOAD_FILE_NAME,
  OTA_UPLOAD_MIME_TYPE,
} from '../constants/ota'
import { OtaServiceError, type OtaError } from './ota.errors'
import { appendHmacTrailer } from './ota-hmac'
import { getOtaHmacSecretBytes } from './ota-secret'
import { Sha256 } from './sha256'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirmwareRelease {
  version: string
  publishedAt: string
  notes: string
  downloadUrl: string
  sizeBytes: number
  /** Lowercase hex SHA-256 digest from the GitHub asset metadata, or null if
   *  the release predates the asset-digest rollout. */
  sha256?: string | null
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  digest?: string | null
}

interface GitHubRelease {
  tag_name: string
  published_at: string
  body: string
  assets: GitHubAsset[]
  draft: boolean
  prerelease: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Multipart upload timeout — generous enough for slow phones, short enough
 *  to fail loud rather than spinning forever on a dead connection. */
const OTA_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000

/** SHA-256 expressed as `sha256:<64 lowercase hex chars>`. */
const SHA256_DIGEST_RE = /^sha256:([a-f0-9]{64})$/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a GitHub asset `digest` field. Returns the lowercase hex digest if
 *  it's a SHA-256 we recognise, otherwise null. */
function parseSha256Digest(digest: string | null | undefined): string | null {
  if (digest == null) return null
  const m = SHA256_DIGEST_RE.exec(digest)
  return m ? (m[1] ?? null) : null
}

/** Throw a typed OTA error wrapped in `OtaServiceError`. */
function fail(cause: OtaError): never {
  throw new OtaServiceError(cause)
}

// ---------------------------------------------------------------------------
// GitHub release fetch
// ---------------------------------------------------------------------------

export async function fetchReleases(): Promise<FirmwareRelease[]> {
  let response: Response
  try {
    response = await fetch(
      `${GITHUB_RELEASES_API}?per_page=${String(GITHUB_RELEASES_PER_PAGE)}`,
    )
  } catch {
    fail({ kind: 'releases-fetch-failed' })
  }
  if (!response.ok) {
    fail({ kind: 'releases-fetch-failed', status: response.status })
  }

  const data = (await response.json()) as GitHubRelease[]

  return data
    .filter((r) => !r.draft && !r.prerelease)
    .map((r): FirmwareRelease | null => {
      const asset = r.assets.find((a) => a.name.endsWith('.bin'))
      if (!asset) return null
      return {
        version: r.tag_name.replace(/^v/, ''),
        publishedAt: r.published_at,
        notes: r.body,
        downloadUrl: asset.browser_download_url,
        sizeBytes: asset.size,
        sha256: parseSha256Digest(asset.digest),
      }
    })
    .filter((r): r is FirmwareRelease => r !== null)
}

// ---------------------------------------------------------------------------
// Download firmware binary (over cellular / current network)
// ---------------------------------------------------------------------------

export async function downloadFirmware(
  release: FirmwareRelease,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory ?? ''}canshift-${release.version}.bin`

  // Cache hit: existing file with matching size — assume verified previously.
  // Checksum is re-verified by the caller via `verifyFirmware` either way.
  const info = await FileSystem.getInfoAsync(dest)
  if (info.exists && info.size === release.sizeBytes) {
    onProgress?.(1)
    return dest
  }

  // Stale cache (size mismatch) — drop before re-downloading
  if (info.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true })
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    release.downloadUrl,
    dest,
    {},
    (downloadProgress) => {
      const total = downloadProgress.totalBytesExpectedToWrite
      if (total > 0) onProgress?.(downloadProgress.totalBytesWritten / total)
    },
  )

  let result: { uri: string } | null | undefined
  try {
    result = await downloadResumable.downloadAsync()
  } catch (e) {
    fail({
      kind: 'download-failed',
      reason: e instanceof Error ? e.message : 'network error',
    })
  }
  if (!result?.uri) {
    fail({ kind: 'download-failed', reason: 'no file written' })
  }
  return result.uri
}

// ---------------------------------------------------------------------------
// Verify the downloaded binary
// ---------------------------------------------------------------------------

/**
 * Verify that the downloaded firmware matches the published release:
 * 1. file size matches `release.sizeBytes` exactly,
 * 2. (when available) SHA-256 matches the GitHub asset digest.
 *
 * Throws `OtaServiceError({ kind: 'size-mismatch' | 'checksum-mismatch' })`
 * on failure. When the release predates the digest rollout (sha256 is null),
 * step 2 is skipped — step 1 still runs.
 */
export async function verifyFirmware(
  localPath: string,
  release: FirmwareRelease,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(localPath)
  const actualSize = info.exists ? info.size : 0
  if (!info.exists || actualSize !== release.sizeBytes) {
    fail({
      kind: 'size-mismatch',
      expected: release.sizeBytes,
      actual: actualSize,
    })
  }

  if (release.sha256 == null) return

  const actualDigest = await sha256OfFile(localPath)
  if (actualDigest !== release.sha256) {
    fail({
      kind: 'checksum-mismatch',
      expected: release.sha256,
      actual: actualDigest,
    })
  }
}

/** Compute the lowercase-hex SHA-256 of a local file via base64-chunked reads.
 *  Hosted in this module rather than `sha256.ts` so the latter stays runtime-
 *  agnostic and trivially unit-testable. */
async function sha256OfFile(uri: string): Promise<string> {
  // Reading the whole file as base64 in one call is the only path expo-file-
  // system gives us; for ~1.4 MB firmware this is fast enough and runs once
  // per OTA flash. If we ever need streaming for larger payloads we'd have to
  // adopt expo-crypto or a chunked reader.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
  return new Sha256().update(bytes).digestHex()
}

// ---------------------------------------------------------------------------
// HMAC-trailer staging for push
// ---------------------------------------------------------------------------

/** Suffix used for the HMAC-trailered staging file. Distinct from the verified
 *  download so re-runs don't have to re-download — only re-stage. */
const HMAC_STAGED_SUFFIX = '.hmac.bin'

/**
 * Read the verified firmware off disk, append the HMAC-SHA256 trailer using
 * the configured secret, and write the result to a sibling staging file.
 * Returns the staging URI. The original `localPath` is left untouched so the
 * cached download can still be reused on a retry.
 *
 * The secret is loaded from `ota-secret.ts` and passed straight into the
 * HMAC primitive — it is never logged, copied to disk, or returned.
 */
async function stageFirmwareWithHmac(localPath: string): Promise<string> {
  const stagedPath = `${localPath}${HMAC_STAGED_SUFFIX}`
  try {
    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const body = new Uint8Array(Buffer.from(base64, 'base64'))
    const trailered = appendHmacTrailer(body, getOtaHmacSecretBytes())
    const stagedBase64 = Buffer.from(trailered).toString('base64')
    await FileSystem.writeAsStringAsync(stagedPath, stagedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return stagedPath
  } catch (e) {
    // Map any FS / encoding failure to a typed error. Reason text comes from
    // the underlying error message — never from the secret material.
    throw new OtaServiceError({
      kind: 'hmac-prepare-failed',
      reason: e instanceof Error ? e.message : 'unknown error',
    })
  }
}

// ---------------------------------------------------------------------------
// Push firmware to ESP32 over WiFi AP
// The device must be in WiFi AP mode (triggered via BLE CMD start_wifi_ap).
// Phone must be connected to the CANShift-XXXX WiFi network.
//
// Wire contract: `<firmware bytes> || HMAC_SHA256(firmware bytes, secret)`.
// The 32-byte trailer is appended in `stageFirmwareWithHmac` before the
// multipart upload. Firmware verifier lives in `hal/wifi/ota_hmac.cpp`.
// ---------------------------------------------------------------------------

export async function pushFirmware(
  localPath: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const stagedPath = await stageFirmwareWithHmac(localPath)
  const formData = new FormData()
  formData.append(OTA_UPLOAD_FIELD_NAME, {
    uri: stagedPath,
    type: OTA_UPLOAD_MIME_TYPE,
    name: OTA_UPLOAD_FILE_NAME,
  } as unknown as Blob)

  const xhr = new XMLHttpRequest()
  // Heuristic for distinguishing "device never reached" from "dropped mid-
  // transfer": if any upload-progress event fired, we did make contact.
  let progressEverFired = false

  await new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      progressEverFired = true
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      // Status 0 here means the request never reached the device; treat that
      // as unreachable rather than rejected so the UI guides the user to the
      // Wi-Fi step rather than blaming the firmware.
      if (xhr.status === 0) {
        reject(new OtaServiceError({ kind: 'device-unreachable' }))
        return
      }
      reject(new OtaServiceError({ kind: 'device-rejected', status: xhr.status }))
    }
    xhr.onerror = () => {
      reject(
        new OtaServiceError(
          progressEverFired
            ? { kind: 'network-dropped' }
            : { kind: 'device-unreachable' },
        ),
      )
    }
    xhr.ontimeout = () => {
      reject(new OtaServiceError({ kind: 'network-dropped' }))
    }

    xhr.open('POST', ESP32_OTA_URL)
    xhr.timeout = OTA_UPLOAD_TIMEOUT_MS
    xhr.send(formData)
  })
}
