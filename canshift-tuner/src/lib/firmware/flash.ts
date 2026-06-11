const FLASH_BAUD = 921_600
const MERGED_FLASH_OFFSET = 0x0

const SUPPORTED_CHIPS: readonly string[] = ['ESP32']

let esptoolModulePromise: Promise<typeof import('esptool-js')> | null = null

const loadEsptool = (): Promise<typeof import('esptool-js')> => {
  esptoolModulePromise ??= import('esptool-js')
  return esptoolModulePromise
}

export type FlashProgress = (loaded: number, total: number) => void
export type FlashLog = (line: string) => void

export interface FlashOptions {
  port: SerialPort
  bytes: Uint8Array
  onProgress: FlashProgress
  onLog: FlashLog
}

export class FlashError extends Error {
  readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'FlashError'
    this.cause = cause
  }
}

export class UnsupportedChipError extends Error {
  readonly detectedChip: string
  constructor(detectedChip: string) {
    super(
      `Refusing to flash — detected ${detectedChip}, CANShift firmware is built only for classic ESP32. Writing it onto a different family will brick the device.`
    )
    this.name = 'UnsupportedChipError'
    this.detectedChip = detectedChip
  }
}

const makeTerminal = (onLog: FlashLog) => ({
  clean: () => undefined,
  writeLine: (line: string) => {
    if (line.trim().length > 0) onLog(line.trim())
  },
  write: (_data: string) => undefined,
})

export const flashFirmware = async ({
  port,
  bytes,
  onProgress,
  onLog,
}: FlashOptions): Promise<void> => {
  const { ESPLoader, Transport } = await loadEsptool()
  const transport = new Transport(port, false)
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: FLASH_BAUD,
      terminal: makeTerminal(onLog),
      debugLogging: false,
    })

    try {
      await loader.main()
    } catch (err) {
      throw new FlashError(
        'Could not enter ESP32 ROM bootloader. Hold BOOT, tap RESET (or unplug/replug while holding BOOT), then retry.',
        err
      )
    }

    const detectedChip = loader.chip.CHIP_NAME
    onLog(`Detected chip: ${detectedChip}`)
    if (!SUPPORTED_CHIPS.includes(detectedChip)) {
      throw new UnsupportedChipError(detectedChip)
    }

    try {
      await loader.writeFlash({
        fileArray: [{ data: bytes, address: MERGED_FLASH_OFFSET }],
        flashMode: 'keep',
        flashFreq: 'keep',
        flashSize: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex, written, total) => {
          if (total > 0) onProgress(written, total)
        },
      })
    } catch (err) {
      throw new FlashError(
        err instanceof Error ? `Flash write failed: ${err.message}` : 'Flash write failed.',
        err
      )
    }

    try {
      await loader.softReset(false)
    } catch {
      onLog('Reset failed — unplug/replug to restart the dash.')
    }
  } finally {
    try {
      await transport.disconnect()
    } catch {
      void 0
    }
  }
}
