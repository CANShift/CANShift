const ESP_IMAGE_MAGIC = 0xe9

export class InvalidFirmwareImageError extends Error {
  readonly firstByte: number
  constructor(firstByte: number) {
    const hex = firstByte.toString(16).padStart(2, '0').toUpperCase()
    super(
      `Not an ESP32 firmware image — expected byte 0x${String(ESP_IMAGE_MAGIC.toString(16).toUpperCase())} at offset 0, got 0x${hex}. Pick a .bin built for ESP32 (bootloader / app / merged).`
    )
    this.name = 'InvalidFirmwareImageError'
    this.firstByte = firstByte
  }
}

export const verifyImageMagic = (bytes: Uint8Array): void => {
  if (bytes.byteLength === 0) {
    throw new InvalidFirmwareImageError(0)
  }
  const head = bytes[0]
  if (head === undefined || head !== ESP_IMAGE_MAGIC) {
    throw new InvalidFirmwareImageError(head ?? 0)
  }
}
