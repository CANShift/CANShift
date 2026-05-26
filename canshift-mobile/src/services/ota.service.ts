// ota.service.ts — Firmware release download + WiFi OTA push
//
// Failure modes are surfaced through the `OtaError` discriminated union (see
// ota.errors.ts) so the UI can render actionable copy. Network drops, size
// mismatches, checksum mismatches and device-side rejections all produce
// distinct, typed failures.
//
// Checksum strategy: GitHub Releases v3 publishes a per-asset
// `digest: "sha256:<hex>"` field on every uploaded asset. We pin that digest
// at listing time, then re-verify it via the pure-JS SHA-256 implementation
// in `sha256.ts` (no native dep required). If a release was uploaded before
// the digest field was rolled out the digest is `null` and we skip checksum
// verification but still enforce the strict size check.
//
// Verification timing (issue #706): the SHA-256 check runs inside
// `stageFirmwareWithHmac` rather than `verifyFirmware`, so the firmware
// bytes are pulled off disk exactly once for both the digest and the HMAC
// trailer. `verifyFirmware` only does the size check pre-Wi-Fi-switch.

import { Buffer } from 'buffer'
// expo-file-system SDK 54 moved the document-/cache-directory + read/write/
// download primitives to the `/legacy` subpath. We keep using them here: the
// new class-based File/Directory API doesn't yet expose
// `createDownloadResumable` with progress callbacks, which the OTA UX
// depends on (downloadFirmware below). Issue/PR thread: expo/expo#30203.
import * as FileSystem from 'expo-file-system/legacy'
import {
  ESP32_OTA_URL,
  GITHUB_RELEASES_API,
  GITHUB_RELEASES_PER_PAGE,
  OTA_UPLOAD_FIELD_NAME,
  OTA_UPLOAD_FILE_NAME,
  OTA_UPLOAD_MIME_TYPE,
  RELEASE_MERGED_ASSET_SUFFIX,
  RELEASE_OTA_ASSET_SUFFIX,
} from '../constants/ota'
import { OtaServiceError, type OtaError } from './ota.errors'
import { appendHmacTrailer } from './ota-hmac'
import { getOtaHmacSecretBytes } from './ota-secret'
import { Sha256 } from './sha256'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * React Native's FormData accepts a `{ uri, type, name }` file descriptor as
 * the second argument to `append`, but the DOM `FormData` lib type only
 * accepts `string | Blob`. This narrow shape is the documented contract from
 * the React Native polyfill — typing it here keeps the cast confined to one
 * site (vs sprinkling `as unknown as Blob` at every upload call).
 */
interface RNFileDescriptor {
  uri: string
  type: string
  name: string
}

function appendRNFile(form: FormData, field: string, file: RNFileDescriptor): void {
  // The cast is unavoidable until @types/react-native ships a typed override
  // for FormData.append — keep it inside this helper so callers stay clean.
  form.append(field, file as unknown as Blob)
}

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

/**
 * Pick the firmware-partition asset (`*-firmware.bin`) from a release. Skips
 * the merged factory image (`*-merged.bin`) and the SPIFFS image — those are
 * NOT valid OTA payloads and pushing them through `Update.write` would brick
 * the device. Returns `null` if no suitable asset is published.
 */
function pickOtaAsset(assets: GitHubAsset[]): GitHubAsset | null {
  return (
    assets.find(
      (a) =>
        a.name.endsWith(RELEASE_OTA_ASSET_SUFFIX) && !a.name.endsWith(RELEASE_MERGED_ASSET_SUFFIX)
    ) ?? null
  )
}

// ---------------------------------------------------------------------------
// GitHub release fetch
// ---------------------------------------------------------------------------

export async function fetchReleases(): Promise<FirmwareRelease[]> {
  let response: Response
  try {
    response = await fetch(`${GITHUB_RELEASES_API}?per_page=${String(GITHUB_RELEASES_PER_PAGE)}`)
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
      const asset = pickOtaAsset(r.assets)
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
  onProgress?: (progress: number) => void
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory ?? ''}canshift-${release.version}.bin`

  // Cache hit: existing file with matching size — assume verified previously.
  // The checksum is still cross-checked at staging time before upload.
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
    }
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
 * Verify that the downloaded firmware matches the published release size.
 *
 * SHA-256 verification is deferred to `stageFirmwareWithHmac` (called from
 * `pushFirmware`) so the firmware bytes are read off disk exactly once for
 * both hash and HMAC computation — this halves the OTA staging memory peak
 * on low-RAM devices (see issue #706).
 *
 * Throws `OtaServiceError({ kind: 'size-mismatch' })` on failure.
 */
export async function verifyFirmware(localPath: string, release: FirmwareRelease): Promise<void> {
  const info = await FileSystem.getInfoAsync(localPath)
  const actualSize = info.exists ? info.size : 0
  if (!info.exists || actualSize !== release.sizeBytes) {
    fail({
      kind: 'size-mismatch',
      expected: release.sizeBytes,
      actual: actualSize,
    })
  }
}

// ---------------------------------------------------------------------------
// HMAC-trailer staging for push
// ---------------------------------------------------------------------------

/** Suffix used for the HMAC-trailered staging file. Distinct from the verified
 *  download so re-runs don't have to re-download — only re-stage. */
const HMAC_STAGED_SUFFIX = '.hmac.bin'

/** Decode a file's base64 contents to a single `Uint8Array`. Scoped so the
 *  base64 string can be released by the GC before downstream allocations
 *  (hash state, HMAC trailer, staged base64) push memory higher. */
async function readFileBytes(localPath: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  })
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

/**
 * Read the verified firmware off disk once, compute both the SHA-256 digest
 * (verified against `expectedSha256` when present) and the HMAC-SHA256
 * trailer over the same buffer, then write `<body> || HMAC` to a sibling
 * staging file. Returns the staging URI.
 *
 * Single-read design (issue #706): the previous implementation called
 * `readAsStringAsync` twice — once in `sha256OfFile` for verification and
 * again here for HMAC staging. That doubled peak heap on low-RAM Android
 * devices for any reasonably sized firmware. We now share one base64 read
 * (plus the decoded `Uint8Array`) for both passes.
 *
 * The original `localPath` is left untouched so the cached download can be
 * reused on a retry. The secret is loaded from `ota-secret.ts` and passed
 * straight into the HMAC primitive — never logged, copied to disk, or
 * returned.
 */
async function stageFirmwareWithHmac(
  localPath: string,
  expectedSha256: string | null
): Promise<string> {
  const stagedPath = `${localPath}${HMAC_STAGED_SUFFIX}`
  try {
    const body = await readFileBytes(localPath)

    if (expectedSha256 != null) {
      const actualSha256 = new Sha256().update(body).digestHex()
      if (actualSha256 !== expectedSha256) {
        fail({
          kind: 'checksum-mismatch',
          expected: expectedSha256,
          actual: actualSha256,
        })
      }
    }

    const trailered = appendHmacTrailer(body, getOtaHmacSecretBytes())
    const stagedBase64 = Buffer.from(trailered).toString('base64')
    await FileSystem.writeAsStringAsync(stagedPath, stagedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return stagedPath
  } catch (e) {
    // Preserve already-typed OTA errors (e.g. checksum-mismatch from above).
    if (e instanceof OtaServiceError) throw e
    // Map any FS / encoding failure to a typed error. Reason text comes from
    // the underlying error message — never from the secret material.
    throw new OtaServiceError({
      kind: 'hmac-prepare-failed',
      reason: e instanceof Error ? e.message : 'unknown error',
    })
  }
}

/** Best-effort removal of the HMAC-trailered staging file. Swallows errors so
 *  cleanup never masks a real OTA failure surfaced earlier in the flow. */
async function discardStagedFile(stagedPath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(stagedPath, { idempotent: true })
  } catch {
    // Intentionally swallow — see doc above. The next OTA run will overwrite
    // the staging file anyway, so a leftover is annoying but not unsafe.
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
  release: FirmwareRelease,
  onProgress?: (progress: number) => void
): Promise<void> {
  const stagedPath = await stageFirmwareWithHmac(localPath, release.sha256 ?? null)
  try {
    await uploadStagedFile(stagedPath, onProgress)
  } finally {
    // Always discard the trailered staging file once the upload terminates —
    // success or failure. The verified `localPath` remains so a retry can
    // re-stage without re-downloading. (Issue #706.)
    await discardStagedFile(stagedPath)
  }
}

/** Multipart-upload the trailered staging file to the dashboard. Throws a
 *  typed `OtaServiceError` on any transport failure; the caller is
 *  responsible for staging and cleanup. */
async function uploadStagedFile(
  stagedPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const formData = new FormData()
  appendRNFile(formData, OTA_UPLOAD_FIELD_NAME, {
    uri: stagedPath,
    type: OTA_UPLOAD_MIME_TYPE,
    name: OTA_UPLOAD_FILE_NAME,
  })

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
          progressEverFired ? { kind: 'network-dropped' } : { kind: 'device-unreachable' }
        )
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
