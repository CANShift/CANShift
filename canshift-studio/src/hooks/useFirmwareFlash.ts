// useFirmwareFlash.ts — Shared esptool-js flash logic used by UpdateRoute.
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

        // The ROM bootloader prints `Flash ID: ffffff` when the chip can't
        // talk to its own flash chip — usually a damaged USB cable, an unpowered
        // hub, or a peripheral pulling on GPIO 6-11 (the SPI flash bus).
        // Detect it from the terminal stream so we can abort before the 60s
        // writeFlash timeout (#371). A mutable ref keeps TS from narrowing the
        // value to a literal `false` after the closure assignment.
        const flashIdState: { bad: boolean } = { bad: false }
        const checkForBadFlashId = (text: string): void => {
          if (flashIdState.bad) return
          if (/Flash ID:\s*ffffff/i.test(text)) {
            flashIdState.bad = true
            appendLog(`Detected bad Flash ID in terminal stream: "${text.trim()}"`, 'error')
          }
        }

        // Build a fresh Transport + ESPLoader pair against the user-granted
        // `port`. Called twice on the retry path (#482) so the second attempt
        // starts from a clean stub state after the first attempt's port was
        // torn down.
        const buildLoader = (): { loader: ESPLoader; transport: Transport } => {
          appendLog('Creating Transport(port) and ESPLoader…')
          const t = new Transport(port, false)
          // Upload baudrate intentionally conservative — 921600 causes Timeouts on
          // many CH340 + USB cable combinations. 460800 is reliable and only ~25%
          // slower for a 1.4 MB image.
          // 230400 chosen empirically — esptool-js 0.6.0 added a Flash ID
          // read step that fails with `Flash ID: ffffff` on CH340 + macOS
          // at 460800 (the stub itself prints "consider using a lower baud
          // rate" in that scenario). 230400 keeps SPI bus comms reliable on
          // this board with only ~50% extra wall-clock per flash.
          const l = new ESPLoader({
            transport: t,
            baudrate: 230400,
            enableTracing: false,
            terminal: {
              write: (text: string) => {
                checkForBadFlashId(text)
                appendLog(text)
              },
              writeLine: (line: string) => {
                checkForBadFlashId(line)
                appendLog(line)
              },
              clean: () => {
                setLogs([])
              },
            },
          })
          return { loader: l, transport: t }
        }

        let { loader, transport } = buildLoader()

        // The main-process reset (firmware.service.resetIntoBootloader) ran
        // inside firmwareIpc.enterFlash() before this point — chip should
        // already be in ROM bootloader. Tell esptool-js to skip its own
        // (Web-Serial-based, flaky on macOS CH340) reset sequence and just
        // sync up. If the main-process reset failed for any reason, mode is
        // still 'no_reset' here — we make exactly ONE automatic retry then
        // surface a manual-intervention error so the user can press BOOT.
        appendLog('Calling loader.main(no_reset) — chip should already be in bootloader')
        try {
          await loader.main('no_reset')
          appendLog('loader.main() OK — bootloader synced')
        } catch (syncErr: unknown) {
          const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr)
          appendLog(
            `[FLASH] Bootloader sync failed (${syncMsg}), retrying once with longer hold…`,
            'warn'
          )
          // Best-effort cleanup of the failed attempt's transport/port so
          // the second attempt opens cleanly. Errors here are expected (the
          // port may already be closed by esptool's failure path) — log
          // and move on.
          if (port.readable !== null) {
            await port.close().catch((closeErr: unknown) => {
              appendLog(
                `Retry pre-close threw (ignored): ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`,
                'warn'
              )
            })
          }
          // Re-run the main-process reset — gives the chip another chance
          // to enter ROM bootloader with the bumped 250 ms latch hold.
          appendLog('Re-running main-process reset via firmwareIpc.enterFlash()…')
          const retryEnter = await firmwareIpc.enterFlash(portPath)
          appendLog(`Retry enterFlash returned — success=${String(retryEnter.success)}`)
          // Reset the bad-Flash-ID latch so the retry's own reading is
          // evaluated fresh (the first attempt may have left a stale flag).
          flashIdState.bad = false
          ;({ loader, transport } = buildLoader())
          appendLog('Calling loader.main(no_reset) — retry attempt')
          try {
            await loader.main('no_reset')
            appendLog('loader.main() OK on retry — bootloader synced')
          } catch (retryErr: unknown) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
            appendLog(`Retry sync also failed: ${retryMsg}`, 'error')
            throw new Error(
              'Bootloader entry failed. If this persists, try briefly pressing the BOOT button on the device while clicking Flash again.',
              { cause: retryErr }
            )
          }
        }

        // Abort before writeFlash if the bootloader reported a bad Flash ID.
        // Continuing would just hang for the full 60s flash-command timeout.
        if (flashIdState.bad) {
          throw new Error(
            "Flash ID is ffffff — the chip can't reach its own flash. Try: another USB cable, a powered hub, no peripherals on GPIO 6-11."
          )
        }

        // -----------------------------------------------------------------
        // Workaround for the esptool-js 0.6.0 stub timeout bug — flash
        // commands hardcode `timeout = DEFAULT_TIMEOUT` (3000 ms) when
        // IS_STUB is true (see esploader.flashDeflBegin). The ESP32 stub
        // erases the target region synchronously before acking, and that
        // erase can run 5-15 s on ~1.3 MB images depending on how much is
        // currently written. Mirror python-esptool's behaviour by widening
        // the floor for every flash-related command via a checkCommand
        // wrapper.
        //
        // 0.6.0 changed `checkCommand`'s signature — added a
        // `responseDataLength` arg between `chk` and `timeout`. Don't omit
        // it: passing 5 args lands `timeout` in the responseDataLength slot
        // and silently does nothing.
        // -----------------------------------------------------------------
        interface EsploaderInternals {
          checkCommand: (
            op: string,
            cmd: number,
            data: Uint8Array,
            chk: number,
            responseDataLength: number,
            timeout: number
          ) => Promise<unknown>
          ESP_FLASH_BEGIN: number
          ESP_FLASH_DATA: number
          ESP_FLASH_END: number
          ESP_FLASH_DEFL_BEGIN: number
          ESP_FLASH_DEFL_DATA: number
          ESP_FLASH_DEFL_END: number
          IS_STUB: boolean
        }
        const loaderI = loader as unknown as EsploaderInternals
        const flashCmds = new Set([
          loaderI.ESP_FLASH_BEGIN,
          loaderI.ESP_FLASH_DATA,
          loaderI.ESP_FLASH_END,
          loaderI.ESP_FLASH_DEFL_BEGIN,
          loaderI.ESP_FLASH_DEFL_DATA,
          loaderI.ESP_FLASH_DEFL_END,
        ])
        const FLASH_MIN_TIMEOUT_MS = 60_000
        const origCheckCommand = loaderI.checkCommand.bind(loaderI)
        let firstFlashCmdLogged = false
        loaderI.checkCommand = async (op, cmd, data, chk, responseDataLength, timeout) => {
          let effectiveTimeout = timeout
          if (loaderI.IS_STUB && flashCmds.has(cmd) && effectiveTimeout < FLASH_MIN_TIMEOUT_MS) {
            effectiveTimeout = FLASH_MIN_TIMEOUT_MS
            if (!firstFlashCmdLogged) {
              appendLog(
                `Patched flash-command timeouts to ${String(FLASH_MIN_TIMEOUT_MS)}ms (esptool-js 0.6.0 stub-timeout workaround)`,
                'info'
              )
              firstFlashCmdLogged = true
            }
          }
          return origCheckCommand(op, cmd, data, chk, responseDataLength, effectiveTimeout)
        }

        // The merged binary (built via `esptool merge_bin 0x1000 bootloader 0x8000
        // partitions 0x10000 firmware`) starts at flash offset 0x0 — it embeds
        // the bootloader at its own 0x1000 internal offset. Writing at 0x1000
        // would shift every component by 0x1000 and brick boot with
        // "flash read err, 1000" from the ROM bootloader.
        // esptool-js 0.6.0 expects Uint8Array for image data (was string in 0.4.x).
        const fileArray: { data: Uint8Array; address: number }[] = [
          { data: new Uint8Array(fwBuffer), address: 0x0 },
        ]
        if (spiffsBuffer) {
          // SPIFFS partition offset per ota_4mb.csv
          fileArray.push({ data: new Uint8Array(spiffsBuffer), address: 0x310000 })
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
          // SparkMD5 wants a binary string; convert the Uint8Array back for it.
          calculateMD5Hash: (image: Uint8Array) => {
            let s = ''
            for (const b of image) s += String.fromCharCode(b)
            return SparkMD5.hashBinary(s)
          },
        })

        appendLog('writeFlash done — running hardReset + cleanup')

        // Cleanup steps after a successful write are best-effort:
        // hardReset (now `loader.after()` in 0.6.0) triggers a USB
        // re-enumeration on macOS which can invalidate the port handle
        // before disconnect()/close() complete. Errors here would mask a
        // successful flash, so we swallow them.
        await loader.after().catch((e: unknown) => {
          appendLog(
            `after() error (ignored): ${e instanceof Error ? e.message : String(e)}`,
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
