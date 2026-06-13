import { computeSha256Hex } from './hash'
import { verifyImageMagic } from './image'

export interface LocalFirmware {
  name: string
  size: number
  bytes: Uint8Array
  sha256: string
}

export type LocalFirmwareErrorKind = 'empty' | 'too-large'

export class LocalFirmwareError extends Error {
  readonly kind: LocalFirmwareErrorKind
  constructor(kind: LocalFirmwareErrorKind, message: string) {
    super(message)
    this.name = 'LocalFirmwareError'
    this.kind = kind
  }
}

export const FIRMWARE_MAX_BYTES = 16 * 1024 * 1024

export const formatBytes = (size: number): string => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MiB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KiB`
  return `${String(size)} B`
}

export const readFirmwareFile = async (file: File): Promise<LocalFirmware> => {
  if (file.size === 0) {
    throw new LocalFirmwareError('empty', 'Firmware file is empty.')
  }
  if (file.size > FIRMWARE_MAX_BYTES) {
    throw new LocalFirmwareError(
      'too-large',
      `Firmware file is ${formatBytes(file.size)} — refusing anything over ${formatBytes(FIRMWARE_MAX_BYTES)}.`
    )
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  verifyImageMagic(bytes)
  const sha256 = await computeSha256Hex(bytes)
  return { name: file.name, size: file.size, bytes, sha256 }
}
