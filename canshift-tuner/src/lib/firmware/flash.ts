const FLASH_BAUD = 460_800
const MERGED_FLASH_OFFSET = 0x0

const SUPPORTED_CHIPS: readonly string[] = ['ESP32']

const PRE_RESET_HOLD_MS = 250
const PRE_RESET_SETTLE_MS = 600

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface SignalCapablePort {
  setSignals?: (signals: {
    dataTerminalReady?: boolean
    requestToSend?: boolean
  }) => Promise<void>
}

const forceRomBootloader = async (port: SerialPort, onLog: FlashLog): Promise<boolean> => {
  const setSignals = (port as SignalCapablePort).setSignals
  if (typeof setSignals !== 'function') return false
  const send = (signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) =>
    setSignals.call(port, signals)
  try {
    onLog('Pre-reset: pulling EN low, IO0 low')
    await send({ dataTerminalReady: false, requestToSend: true })
    await sleep(PRE_RESET_HOLD_MS)
    await send({ dataTerminalReady: true, requestToSend: false })
    await sleep(PRE_RESET_SETTLE_MS)
    await send({ dataTerminalReady: false, requestToSend: false })
    onLog('Pre-reset complete — chip should be in ROM bootloader')
    return true
  } catch (err) {
    onLog(`Pre-reset failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

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

const ROM_BOOTLOADER_CONNECT_ATTEMPTS = 15

export const flashFirmware = async ({
  port,
  bytes,
  onProgress,
  onLog,
}: FlashOptions): Promise<void> => {
  let preResetSucceeded = false
  try {
    await port.open({ baudRate: 115_200 })
    preResetSucceeded = await forceRomBootloader(port, onLog)
  } catch (err) {
    onLog(`Pre-reset port open failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    try {
      await port.close()
    } catch (err) {
      onLog(`Pre-reset port close failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const connectMode = preResetSucceeded ? 'no_reset' : 'default_reset'

  const { ESPLoader, Transport } = await loadEsptool()
  const transport = new Transport(port, false)
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: FLASH_BAUD,
      terminal: makeTerminal(onLog),
      debugLogging: false,
    })

    const originalConnect = loader.connect.bind(loader)
    loader.connect = (
      mode = connectMode,
      _attempts = ROM_BOOTLOADER_CONNECT_ATTEMPTS,
      detecting = true
    ) => originalConnect(mode, ROM_BOOTLOADER_CONNECT_ATTEMPTS, detecting)

    try {
      await loader.main(connectMode)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new FlashError(
        `ESP32 bootloader handshake failed (${detail}). If the chip was detected and the failure happened after baud change, try a lower FLASH_BAUD. Otherwise hold BOOT, tap RESET, and retry.`,
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
