import { useState } from 'react'
import { flashFirmware, FlashError } from '../lib/firmware/flash'
import { useFirmwareSelectionStore } from '../stores/firmware-selection.store'
import { useLogStore } from '../stores/log.store'

export type FlasherState =
  | { kind: 'idle' }
  | { kind: 'flashing'; written: number; total: number }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

const isWebSerialAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'serial' in navigator

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
  const port = await navigator.serial.requestPort()
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
  log('success', 'Flash completed — dash is rebooting')
}
