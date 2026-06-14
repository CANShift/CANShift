const ESP_IMAGE_MAGIC = 0xe9
const BOOTLOADER_FLASH_OFFSET = 0x1000

export class InvalidFirmwareImageError extends Error {
  readonly firstByte: number
  constructor(firstByte: number) {
    const hex = firstByte.toString(16).padStart(2, '0').toUpperCase()
    const magicHex = ESP_IMAGE_MAGIC.toString(16).toUpperCase()
    const bootHex = BOOTLOADER_FLASH_OFFSET.toString(16).toUpperCase()
    super(
      `Not an ESP32 firmware image — expected magic byte 0x${magicHex} at offset 0 or 0x${bootHex}, got 0x${hex} at offset 0. Pick a .bin built for ESP32 (bootloader / app / firmware / merged).`
    )
    this.name = 'InvalidFirmwareImageError'
    this.firstByte = firstByte
  }
}

export const verifyImageMagic = (bytes: Uint8Array): void => {
  if (bytes.byteLength === 0) {
    throw new InvalidFirmwareImageError(0)
  }
  if (bytes[0] === ESP_IMAGE_MAGIC) return
  if (
    bytes.byteLength > BOOTLOADER_FLASH_OFFSET &&
    bytes[BOOTLOADER_FLASH_OFFSET] === ESP_IMAGE_MAGIC
  ) {
    return
  }
  throw new InvalidFirmwareImageError(bytes[0] ?? 0)
}
