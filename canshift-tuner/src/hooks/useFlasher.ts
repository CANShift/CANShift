import { flashFirmware, FlashError } from '../lib/firmware/flash'
import { downloadFirmwareAsset } from '../lib/firmware/download'
import { flashFirmwareOta, OtaError } from '../lib/firmware/ota'
import { findFirmwareAsset } from '../lib/firmware/releases'
import { useConnectionStore } from '../stores/connection.store'
import {
  type FirmwareSelection,
  useFirmwareSelectionStore,
} from '../stores/firmware-selection.store'
import { useLogStore } from '../stores/log.store'
import { useFlasherStore } from '../stores/flasher.store'
import type { FlasherState } from '../stores/flasher.store'

export type { FlasherState }

const isWebSerialAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'serial' in navigator

const DISCONNECT_WAIT_MS = 1500
const DISCONNECT_POLL_MS = 50

const waitForDisconnect = async (): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < DISCONNECT_WAIT_MS) {
    if (useConnectionStore.getState().status === 'disconnected') return
    await new Promise<void>((resolve) => setTimeout(resolve, DISCONNECT_POLL_MS))
  }
}

const acquirePort = async (
  log: ReturnType<typeof useLogStore.getState>['push']
): Promise<SerialPort> => {
  const conn = useConnectionStore.getState()
  if (conn.port && conn.status === 'connected') {
    const port = conn.port
    log('info', 'Releasing tuner port for flashing')
    conn.disconnect()
    await waitForDisconnect()
    return port
  }
  return navigator.serial.requestPort()
}

export interface UseFlasher {
  state: FlasherState
  canFlash: boolean
  flash: () => void
  reset: () => void
}

export const useFlasher = (): UseFlasher => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const log = useLogStore((s) => s.push)
  const state = useFlasherStore((s) => s.state)
  const setState = useFlasherStore((s) => s.setState)

  const canFlash = selection.kind !== 'none' && state.kind !== 'flashing' && isWebSerialAvailable()

  const flash = () => {
    if (selection.kind === 'none') return
    if (!isWebSerialAvailable()) {
      setState({ kind: 'error', message: 'WebSerial unavailable in this browser.' })
      return
    }
    const name = selection.kind === 'release' ? selection.release.tag : selection.firmware.name
    log('info', `Flash requested — ${name}`)

    void runFlash(selection, log, setState).catch((err: unknown) => {
      const message =
        err instanceof FlashError || err instanceof OtaError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      setState({ kind: 'error', message })
      log('error', `Flash failed: ${message}`)
    })
  }

  const reset = () => {
    setState({ kind: 'idle' })
  }

  return { state, canFlash, flash, reset }
}

const resolveOtaBytes = async (
  selection: Exclude<FirmwareSelection, { kind: 'none' }>,
  log: ReturnType<typeof useLogStore.getState>['push']
): Promise<Uint8Array> => {
  if (selection.kind === 'local') return selection.firmware.bytes

  const asset = findFirmwareAsset(selection.release)
  if (!asset) {
    log(
      'warn',
      'No app-only firmware.bin asset on this release — falling back to merged bytes (may not boot via OTA)'
    )
    return selection.firmware.bytes
  }
  log('info', `Fetching ${asset.name} for OTA (app partition only)`)
  const firmware = await downloadFirmwareAsset(asset, () => undefined)
  return firmware.bytes
}

const runFlash = async (
  selection: Exclude<FirmwareSelection, { kind: 'none' }>,
  log: ReturnType<typeof useLogStore.getState>['push'],
  setState: (next: FlasherState) => void
): Promise<void> => {
  const conn = useConnectionStore.getState()
  const canUseOta = conn.status === 'connected'

  if (canUseOta) {
    log('info', 'Using OTA over USB — no BOOT button needed')
    const bytes = await resolveOtaBytes(selection, log)
    setState({ kind: 'flashing', written: 0, total: bytes.byteLength })
    await flashFirmwareOta({
      bytes,
      onProgress: (sent, total) => {
        setState({ kind: 'flashing', written: sent, total })
      },
      onLog: (line) => {
        log('info', `[ota] ${line}`)
      },
    })
    setState({ kind: 'success' })
    log('success', 'OTA completed — dash is rebooting into the new firmware')
    return
  }

  log('info', 'No active USB session — falling back to esptool flash (hold BOOT during reset)')
  const bytes = selection.firmware.bytes
  const port = await acquirePort(log)
  setState({ kind: 'flashing', written: 0, total: bytes.byteLength })
  await flashFirmware({
    port,
    bytes,
    onProgress: (written, total) => {
      setState({ kind: 'flashing', written, total })
    },
    onLog: (line) => {
      log('info', `[flash] ${line}`)
    },
  })
  setState({ kind: 'success' })
  log(
    'success',
    'Flash completed — dash is rebooting. Reconnect via Welcome when it comes back up.'
  )
}
