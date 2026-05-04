// useFirmwareFlash.ts — Shared esptool-js flash logic for FirmwareDialog and UpdateRoute.
//
// Uses the Web Serial API in the renderer — no esptool CLI required.
// Simulation mode runs a fake progress sequence without touching the port.

import { useState, useCallback } from 'react'
import { ESPLoader, Transport } from 'esptool-js'
import SparkMD5 from 'spark-md5'
import { firmwareIpc, usbService } from '../services/ipc.service'
import { useDeviceStore } from '../stores/device.store'

export type FlashState = 'idle' | 'downloading' | 'connecting' | 'flashing' | 'done' | 'error'
export type FlashPhase = 'downloading' | 'connecting' | 'flashing'
export type FlashSource = { type: 'url'; url: string } | { type: 'file'; file: File }

function bufferToString(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return str
}

async function downloadBinary(
  url: string,
  onProgress: (pct: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: HTTP ${String(response.status)}`)
  const total = parseInt(response.headers.get('content-length') ?? '0', 10)
  const { body } = response
  if (!body) throw new Error('No response body')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)))
  }
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  onProgress(100)
  return merged.buffer
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
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setDisconnected = useDeviceStore((s) => s.setDisconnected)

  const [state, setState] = useState<FlashState>('idle')
  const [phase, setPhase] = useState<FlashPhase>('downloading')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, text])
  }, [])

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

      setState('downloading')
      setPhase('downloading')
      setProgress(0)
      setLogs([])
      setError(null)

      if (simulationMode) {
        await simulateFlash(
          displayLabel,
          Boolean(spiffsUrl),
          setState,
          setPhase,
          setProgress,
          appendLog
        )
        return { success: true }
      }

      try {
        appendLog(`Flashing ${displayLabel} to ${portPath}…`)
        await firmwareIpc.enterFlash(portPath)
        setDisconnected()

        // Download firmware binary (0–30% if SPIFFS present, 0–40% otherwise)
        let fwBuffer: ArrayBuffer
        const fwCeiling = spiffsUrl ? 30 : 40
        if (source.type === 'url') {
          appendLog('Downloading firmware…')
          fwBuffer = await downloadBinary(source.url, (pct) => {
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
          spiffsBuffer = await downloadBinary(spiffsUrl, (pct) => {
            setProgress(30 + Math.round((pct / 100) * 10))
          })
          appendLog(`SPIFFS ready (${(spiffsBuffer.byteLength / 1024).toFixed(1)} KB)`)
        }

        setState('connecting')
        setPhase('connecting')
        appendLog('Opening serial port…')
        const port = await navigator.serial.requestPort()
        await port.open({ baudRate: 115200 })
        appendLog('Port open at 115200 baud')

        setState('flashing')
        setPhase('flashing')
        const transport = new Transport(port, false)
        const loader = new ESPLoader({
          transport,
          baudrate: 921600,
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

        await loader.main()

        const fileArray: { data: string; address: number }[] = [
          { data: bufferToString(fwBuffer), address: 0x1000 },
        ]
        if (spiffsBuffer) {
          // SPIFFS partition offset per ota_4mb.csv
          fileArray.push({ data: bufferToString(spiffsBuffer), address: 0x310000 })
        }

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

        await loader.hardReset()
        await transport.disconnect()
        await port.close()
        appendLog('Device rebooting…')

        setProgress(100)
        setState('done')
        await firmwareIpc.exitFlash()

        // Auto-reconnect after device reboots (~3.5s)
        setTimeout(() => {
          usbService
            .connect(portPath)
            .then((result) => {
              if (result.success) setConnected(portPath)
            })
            .catch(() => {
              /* best-effort */
            })
        }, 3_500)

        return { success: true }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setState('error')
        await firmwareIpc.exitFlash().catch(() => {
          /* best-effort */
        })
        return { success: false, error: msg }
      }
    },
    [simulationMode, appendLog, setDisconnected, setConnected]
  )

  return { state, phase, progress, logs, error, flash, reset }
}
