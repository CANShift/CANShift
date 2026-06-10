import { Buffer } from 'buffer'
import * as FileSystem from 'expo-file-system'
import {
  ESP32_OTA_URL,
  OTA_UPLOAD_FIELD_NAME,
  OTA_UPLOAD_FILE_NAME,
  OTA_UPLOAD_MIME_TYPE,
} from '../constants/ota'
import { OtaServiceError, type OtaError } from './ota.errors'
import { appendHmacTrailer } from './ota-hmac'
import { getOtaHmacSecretBytes } from './ota-secret'
import { Sha256 } from './sha256'

interface RNFileDescriptor {
  uri: string
  type: string
  name: string
}

const appendRNFile = (form: FormData, field: string, file: RNFileDescriptor): void => {
  form.append(field, file as unknown as Blob)
}

export interface FirmwareRelease {
  version: string
  publishedAt: string
  notes: string
  downloadUrl: string
  sizeBytes: number
  sha256?: string | null
}

const OTA_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000

const fail = (cause: OtaError): never => {
  throw new OtaServiceError(cause)
}

export const downloadFirmware = async (
  release: FirmwareRelease,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const dest = `${FileSystem.cacheDirectory ?? ''}canshift-${release.version}.bin`

  const info = await FileSystem.getInfoAsync(dest)
  if (info.exists && info.size === release.sizeBytes) {
    onProgress?.(1)
    return dest
  }

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
    return fail({ kind: 'download-failed', reason: 'no file written' })
  }
  return result.uri
}

export const verifyFirmware = async (
  localPath: string,
  release: FirmwareRelease
): Promise<void> => {
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

const HMAC_STAGED_SUFFIX = '.hmac.bin'

const readFileBytes = async (localPath: string): Promise<Uint8Array> => {
  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  })
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

const stageFirmwareWithHmac = async (
  localPath: string,
  expectedSha256: string | null
): Promise<string> => {
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
    if (e instanceof OtaServiceError) throw e
    throw new OtaServiceError({
      kind: 'hmac-prepare-failed',
      reason: e instanceof Error ? e.message : 'unknown error',
    })
  }
}

const discardStagedFile = async (stagedPath: string): Promise<void> => {
  try {
    await FileSystem.deleteAsync(stagedPath, { idempotent: true })
  } catch {
    void 0
  }
}

export const pushFirmware = async (
  localPath: string,
  release: FirmwareRelease,
  onProgress?: (progress: number) => void
): Promise<void> => {
  const stagedPath = await stageFirmwareWithHmac(localPath, release.sha256 ?? null)
  try {
    await uploadStagedFile(stagedPath, onProgress)
  } finally {
    await discardStagedFile(stagedPath)
  }
}

const uploadStagedFile = async (
  stagedPath: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  const formData = new FormData()
  appendRNFile(formData, OTA_UPLOAD_FIELD_NAME, {
    uri: stagedPath,
    type: OTA_UPLOAD_MIME_TYPE,
    name: OTA_UPLOAD_FILE_NAME,
  })

  const xhr = new XMLHttpRequest()
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
