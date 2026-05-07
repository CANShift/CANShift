// useFirmwareFlash.ts — Shared esptool-js flash logic for FirmwareDialog and UpdateRoute.
//
// Uses the Web Serial API in the renderer — no esptool CLI required.
// Simulation mode runs a fake progress sequence without touching the port.

import { useState, useCallback } from 'react'
import { ESPLoader, Transport } from 'esptool-js'
import SparkMD5 from 'spark-md5'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareDownloadProgress } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'

export type FlashState = 'idle' | 'downloading' | 'connecting' | 'flashing' | 'done' | 'error'
export type FlashPhase = 'downloading' | 'connecting' | 'flashing'
export type FlashSource = { type: 'url'; url: string } | { type: 'file'; file: File }

function bufferToString(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return str
}

async function downloadBinaryViaIpc(
  url: string,
  onProgress: (pct: number) => void
): Promise<ArrayBuffer> {
  const downloadId = `dl-${String(Date.now())}-${Math.random().toString(36).slice(2)}`

  const handleProgress = (payload: unknown): void => {
    if (typeof payload !== 'object' || payload === null) return
    const p = payload as FirmwareDownloadProgress
    if (p.downloadId !== downloadId) return
    if (p.total > 0) {
      onProgress(Math.min(99, Math.round((p.received / p.total) * 100)))
    }
  }

  window.ipc.on(IpcChannels.FIRMWARE_DOWNLOAD_PROGRESS, handleProgress)
  try {
    const buffer = await firmwareIpc.download(url, downloadId)
    onProgress(100)
    return buffer
  } finally {
    window.ipc.off(IpcChannels.FIRMWARE_DOWNLOAD_PROGRESS, handleProgress)
  }
}

async function simulateFlash(
  label: string,
  withSpiffs: boolean,
  onState: (s: FlashState) => void,
  onPhase: (p: FlashPhase) => void,
  onProgress: (pct: number) => void,
  onLog: (msg: string) => void
): Promise<void> {
  onState('downloading')
  onPhase('downloading')
  onLog(`[sim] Simulating download: ${label}`)
  for (let pct = 0; pct <= 100; pct += 10) {
    onProgress(Math.round(pct * (withSpiffs ? 0.3 : 0.4)))
    await new Promise<void>((r) => setTimeout(r, 60))
  }
  if (withSpiffs) {
    onLog('[sim] Simulating SPIFFS download…')
    for (let pct = 0; pct <= 100; pct += 20) {
      onProgress(30 + Math.round(pct * 0.1))
      await new Promise<void>((r) => setTimeout(r, 40))
    }
  }
  onState('flashing')
  onPhase('flashing')
  onLog('[sim] Simulating flash…')
  for (let pct = 0; pct <= 100; pct += 5) {
    onProgress(40 + Math.round(pct * 0.55))
    await new Promise<void>((r) => setTimeout(r, 90))
  }
  onProgress(100)
  onState('done')
  onLog('[sim] Flash complete')
}

export function useFirmwareFlash() {
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setDisconnected = useDeviceStore((s) => s.setDisconnected)
  const setFlashing = useDeviceStore((s) => s.setFlashing)
  const pushGlobalLog = useLogStore((s) => s.push)

  const [state, setState] = useState<FlashState>('idle')
  const [phase, setPhase] = useState<FlashPhase>('downloading')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // appendLog mirrors every flash event into the global Console panel so the
  // user can copy a full diagnostic trace.
  const appendLog = useCallback(
    (text: string, level: 'info' | 'warn' | 'error' = 'info') => {
      setLogs((prev) => [...prev, text])
      pushGlobalLog(level, `[flash] ${text}`)
    },
    [pushGlobalLog]
  )

  const reset = useCallback(() => {
    setState('idle')
    setPhase('downloading')
    setProgress(0)
    setLogs([])
    setError(null)
  }, [])

  const flash = useCallback(
    async (
      source: FlashSource,
      portPath: string,
      label?: string,
      spiffsUrl?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const displayLabel = label ?? (source.type === 'url' ? source.url : source.file.name)

      setLogs([])
      setError(null)
      setProgress(0)
      // Pause useAutoConnect for the entire flash window — including the
      // simulation path so the dev/sim flow exercises the same gate. Cleared
      // in the finally block at the bottom of this callback.
      setFlashing(true)

      if (simulationMode) {
        try {
          setState('downloading')
          setPhase('downloading')
          await simulateFlash(
            displayLabel,
            Boolean(spiffsUrl),
            setState,
            setPhase,
            setProgress,
            appendLog
          )
          return { success: true }
        } finally {
          setFlashing(false)
        }
      }

      appendLog(
        `flash() start — label=${displayLabel} portPath=${portPath} spiffs=${String(Boolean(spiffsUrl))}`
      )

      // STAGE 1 — call requestPort first while the user gesture is still valid.
      // Any await before this consumes the activation token and Chromium throws
      // "Must be handling a user gesture to show a permission request".
      setState('connecting')
      setPhase('connecting')
      appendLog('Calling navigator.serial.requestPort()…')

      let port: SerialPort
      try {
        port = await navigator.serial.requestPort()
        appendLog(
          `requestPort returned — readable=${port.readable === null ? 'null' : 'open'} writable=${port.writable === null ? 'null' : 'open'}`
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        appendLog(`requestPort failed: ${msg}`, 'error')
        setError(msg)
        setState('error')
        setFlashing(false)
        return { success: false, error: msg }
      }

      try {
        appendLog(`Calling firmwareIpc.enterFlash(${portPath})…`)
        const enterResult = await firmwareIpc.enterFlash(portPath)
        appendLog(`enterFlash returned — success=${String(enterResult.success)}`)
        setDisconnected()
        appendLog(`Renderer state: setDisconnected() called`)

        // Download firmware binary (0–30% if SPIFFS present, 0–40% otherwise)
        setState('downloading')
        setPhase('downloading')
        let fwBuffer: ArrayBuffer
        const fwCeiling = spiffsUrl ? 30 : 40
        if (source.type === 'url') {
          appendLog('Downloading firmware…')
          fwBuffer = await downloadBinaryViaIpc(source.url, (pct) => {
            setProgress(Math.round((pct / 100) * fwCeiling))
          })
          appendLog(`Firmware ready (${(fwBuffer.byteLength / 1024).toFixed(1)} KB)`)
        } else {
          appendLog(`Reading ${source.file.name} (${(source.file.size / 1024).toFixed(1)} KB)`)
          fwBuffer = await source.file.arrayBuffer()
          setProgress(fwCeiling)
        }

        // Download SPIFFS image (30–40%) if provided
        let spiffsBuffer: ArrayBuffer | null = null
        if (spiffsUrl) {
          appendLog('Downloading SPIFFS…')
          spiffsBuffer = await downloadBinaryViaIpc(spiffsUrl, (pct) => {
            setProgress(30 + Math.round((pct / 100) * 10))
          })
          appendLog(`SPIFFS ready (${(spiffsBuffer.byteLength / 1024).toFixed(1)} KB)`)
        }

        // esptool-js opens the port itself inside loader.main() (transport.connect()).
        // If we open it here, esptool's open() throws 'already open'.
        // If a previous failed attempt left the port open, close it so esptool can re-open cleanly.
        appendLog(
          `Pre-esptool port state — readable=${port.readable === null ? 'null' : 'open'} writable=${port.writable === null ? 'null' : 'open'}`
        )
        if (port.readable !== null) {
          appendLog('Port left open from previous attempt — closing for esptool…', 'warn')
          await port.close().catch((closeErr: unknown) => {
            const m = closeErr instanceof Error ? closeErr.message : String(closeErr)
            appendLog(`port.close threw (ignored): ${m}`, 'warn')
          })
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const stillOpen = port.readable !== null
          appendLog(`After close — readable=${stillOpen ? 'open' : 'null'}`)
          if (stillOpen) {
            appendLog(
              'Port stuck open after close attempt. Calling forget() and aborting.',
              'error'
            )
            await port.forget().catch(() => {
              /* best-effort */
            })
            throw new Error('Serial port is stuck — unplug the device, plug it back in, then retry')
          }
        }

        setState('flashing')
        setPhase('flashing')
        appendLog('Creating Transport(port) and ESPLoader…')
        const transport = new Transport(port, false)
        // Upload baudrate intentionally conservative — 921600 causes Timeouts on
        // many CH340 + USB cable combinations. 460800 is reliable and only ~25%
        // slower for a 1.4 MB image.
        const loader = new ESPLoader({
          transport,
          baudrate: 460800,
          romBaudrate: 115200,
          enableTracing: false,
          terminal: {
            write: (text: string) => {
              appendLog(text)
            },
            writeLine: (line: string) => {
              appendLog(line)
            },
            clean: () => {
              setLogs([])
            },
          },
        })

        appendLog('Calling loader.main() — chip detection + bootloader handshake')
        await loader.main()
        appendLog('loader.main() OK — bootloader synced')

        // The merged binary (built via `esptool merge_bin 0x1000 bootloader 0x8000
        // partitions 0x10000 firmware`) starts at flash offset 0x0 — it embeds
        // the bootloader at its own 0x1000 internal offset. Writing at 0x1000
        // would shift every component by 0x1000 and brick boot with
        // "flash read err, 1000" from the ROM bootloader.
        const fileArray: { data: string; address: number }[] = [
          { data: bufferToString(fwBuffer), address: 0x0 },
        ]
        if (spiffsBuffer) {
          // SPIFFS partition offset per ota_4mb.csv
          fileArray.push({ data: bufferToString(spiffsBuffer), address: 0x310000 })
        }
        appendLog(`Calling writeFlash with ${String(fileArray.length)} image(s)`)

        await loader.writeFlash({
          fileArray,
          flashSize: 'keep',
          flashMode: 'keep',
          flashFreq: 'keep',
          eraseAll: false,
          compress: true,
          reportProgress: (_idx: number, written: number, total: number) => {
            setProgress(40 + Math.round((written / total) * 55)) // 40–95 %
          },
          calculateMD5Hash: (image: string) => SparkMD5.hashBinary(image),
        })

        appendLog('writeFlash done — running hardReset + cleanup')

        // Cleanup steps after a successful write are best-effort:
        // hardReset triggers a USB re-enumeration on macOS which can invalidate
        // the port handle before disconnect()/close() complete. Errors here
        // would mask a successful flash, so we swallow them.
        await loader.hardReset().catch((e: unknown) => {
          appendLog(
            `hardReset error (ignored): ${e instanceof Error ? e.message : String(e)}`,
            'warn'
          )
        })
        await transport.disconnect().catch((e: unknown) => {
          appendLog(
            `transport.disconnect error (ignored): ${e instanceof Error ? e.message : String(e)}`,
            'warn'
          )
        })
        await port.close().catch((e: unknown) => {
          appendLog(
            `port.close error (ignored): ${e instanceof Error ? e.message : String(e)}`,
            'warn'
          )
        })
        appendLog('Device rebooting…')

        setProgress(100)
        setState('done')
        await firmwareIpc.exitFlash().catch(() => {
          /* best-effort */
        })

        // useAutoConnect picks the device back up within 2s once exitFlash
        // clears the flashPort lock — no need for a hard-coded reconnect here.
        setFlashing(false)
        return { success: true }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setState('error')
        // Cleanup: close the port so the next attempt opens cleanly
        if (port.readable !== null) {
          await port.close().catch(() => {
            /* best-effort */
          })
        }
        await firmwareIpc.exitFlash().catch(() => {
          /* best-effort */
        })
        setFlashing(false)
        return { success: false, error: msg }
      }
    },
    [simulationMode, appendLog, setDisconnected, setFlashing]
  )

  return { state, phase, progress, logs, error, flash, reset }
}
