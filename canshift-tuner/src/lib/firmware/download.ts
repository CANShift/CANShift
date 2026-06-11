import type { ReleaseAsset } from '@tmbk/canshift-core'
import { verifyImageMagic } from './image'
import { FIRMWARE_MAX_BYTES, LocalFirmwareError } from './local-firmware'
import type { LocalFirmware } from './local-firmware'

const DIGEST_PREFIX = 'sha256:'
const FETCH_TIMEOUT_MS = 30_000

const toHex = (bytes: Uint8Array): string => {
  let out = ''
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0')
  }
  return out
}

const computeSha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return toHex(new Uint8Array(digest))
}

export type DownloadProgress = (loaded: number, total: number) => void

export const downloadFirmwareAsset = async (
  asset: ReleaseAsset,
  onProgress?: DownloadProgress
): Promise<LocalFirmware> => {
  if (asset.sizeBytes > FIRMWARE_MAX_BYTES) {
    throw new LocalFirmwareError(
      'too-large',
      `Release asset is ${String(asset.sizeBytes)} bytes — refusing anything over ${String(FIRMWARE_MAX_BYTES)}.`
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(asset.downloadUrl, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${String(response.status)}`)
  }

  const bytes = await readWithProgress(response, asset.sizeBytes, onProgress)
  if (bytes.byteLength === 0) {
    throw new LocalFirmwareError('empty', 'Downloaded firmware is empty.')
  }

  verifyImageMagic(bytes)
  const sha256 = await computeSha256Hex(bytes)

  const expected = asset.digest
  if (typeof expected === 'string') {
    const expectedHex = expected.startsWith(DIGEST_PREFIX)
      ? expected.slice(DIGEST_PREFIX.length).toLowerCase()
      : expected.toLowerCase()
    if (expectedHex !== sha256) {
      throw new Error(
        `Checksum mismatch — expected ${expectedHex.slice(0, 12)}…, got ${sha256.slice(0, 12)}…`
      )
    }
  }

  return { name: asset.name, size: bytes.byteLength, bytes, sha256 }
}

const readWithProgress = async (
  response: Response,
  expectedSize: number,
  onProgress?: DownloadProgress
): Promise<Uint8Array> => {
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    onProgress?.(buffer.byteLength, expectedSize)
    return new Uint8Array(buffer)
  }
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress?.(received, expectedSize)
  }
  const out = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
