import { useState } from 'react'
import { flashFirmware, FlashError } from '../lib/firmware/flash'
import { useConnectionStore } from '../stores/connection.store'
import { useFirmwareSelectionStore } from '../stores/firmware-selection.store'
import { useLogStore } from '../stores/log.store'

export type FlasherState =
  | { kind: 'idle' }
  | { kind: 'flashing'; written: number; total: number }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

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
  const [state, setState] = useState<FlasherState>({ kind: 'idle' })

  const canFlash = selection.kind !== 'none' && state.kind !== 'flashing' && isWebSerialAvailable()

  const flash = () => {
    if (selection.kind === 'none') return
    if (!isWebSerialAvailable()) {
      setState({ kind: 'error', message: 'WebSerial unavailable in this browser.' })
      return
    }
    const name = selection.kind === 'release' ? selection.release.tag : selection.firmware.name
    log('info', `Flash requested — ${name}`)

    void runFlash(selection.firmware.bytes, log, setState).catch((err: unknown) => {
      const message =
        err instanceof FlashError ? err.message : err instanceof Error ? err.message : String(err)
      setState({ kind: 'error', message })
      log('error', `Flash failed: ${message}`)
    })
  }

  const reset = () => {
    setState({ kind: 'idle' })
  }

  return { state, canFlash, flash, reset }
}

const runFlash = async (
  bytes: Uint8Array,
  log: ReturnType<typeof useLogStore.getState>['push'],
  setState: (next: FlasherState) => void
): Promise<void> => {
  const port = await acquirePort(log)
  setState({ kind: 'flashing', written: 0, total: bytes.byteLength })
  await flashFirmware({
    port,
    bytes,
    onProgress: (written, total) => {
      setState({ kind: 'flashing', written, total })
    },
    onLog: (line) => {
      log('debug', `[flash] ${line}`)
    },
  })
  setState({ kind: 'success' })
  log(
    'success',
    'Flash completed — dash is rebooting. Reconnect via Welcome when it comes back up.'
  )
}
