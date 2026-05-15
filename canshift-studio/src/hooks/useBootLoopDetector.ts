// useBootLoopDetector.ts — Watches the device-log stream for repeated boot
// banners and feeds them into `useBootLoopStore` (#498). Mounted once at the
// App root, alongside the other global IPC listeners.
//
// On every USB_DEVICE_LOG event:
//   - `[BOOT] CANShift vX.Y.Z starting` → snapshot the ring of preceding lines
//     (the actual crash context), clear the ring, push a marker into the store.
//     A QUIET_RESET_MS timer is (re)armed; if no further boot banners fire
//     within that window we assume the device stabilised and reset the store.
//   - `[BOOT] Ready` (the firmware sentinel emitted once setup() completes —
//     see #486) → boot finished cleanly, reset the store + timer immediately.
//   - Any other line → push into the ring buffer, capped at CONTEXT_LINES.
//
// Disconnect (or simulation/no-port) wipes the ring and the store so a brand
// new device starts from a clean slate.

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import {
  CONTEXT_LINES,
  QUIET_RESET_MS,
  type CapturedLine,
  useBootLoopStore,
} from '../stores/bootLoop.store'
import { BOOT_VERSION_RE } from './useFirmwareCheck'
import { IpcChannels } from '../../shared/ipc-channels'
import { isDeviceLogPayload } from '../services/ipc.service'

/** Sentinel emitted by the firmware once setup() finishes — see #486. */
const BOOT_READY_RE = /\bReady\b/

export function useBootLoopDetector(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)

  // Ring buffer of the most recent device-log lines, capped at CONTEXT_LINES.
  // Cloned (not referenced) into the store on every boot marker so the store
  // owns a stable snapshot independent of subsequent ring mutations.
  const ringRef = useRef<CapturedLine[]>([])
  // Quiet-period timer — armed after every boot marker, cleared on Ready or
  // unmount. When it fires we assume the device stopped restarting.
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Brand-new connect or disconnect — clear local + store state so a stale
    // ring from a previous board can't leak into the new probe.
    ringRef.current = []
    if (quietTimerRef.current !== null) {
      clearTimeout(quietTimerRef.current)
      quietTimerRef.current = null
    }
    useBootLoopStore.getState().reset()

    // Without a real connected port there's nothing to listen to (sim/no-port).
    if (!connected || !portPath || simulationMode) return

    const clearQuietTimer = (): void => {
      if (quietTimerRef.current !== null) {
        clearTimeout(quietTimerRef.current)
        quietTimerRef.current = null
      }
    }

    const armQuietTimer = (): void => {
      clearQuietTimer()
      quietTimerRef.current = setTimeout(() => {
        useBootLoopStore.getState().reset()
        quietTimerRef.current = null
      }, QUIET_RESET_MS)
    }

    const handleDeviceLog = (payload: unknown): void => {
      if (!isDeviceLogPayload(payload)) return

      if (payload.tag === 'BOOT') {
        const versionMatch = BOOT_VERSION_RE.exec(payload.message)
        if (versionMatch?.[1]) {
          const snapshot = ringRef.current.slice(-CONTEXT_LINES)
          // Clear the ring so the NEXT boot's context only contains lines that
          // arrived between the two markers (the actual crash window).
          ringRef.current = []
          useBootLoopStore.getState().recordBootMarker(Date.now(), versionMatch[1], snapshot)
          armQuietTimer()
          return
        }
        if (BOOT_READY_RE.test(payload.message)) {
          clearQuietTimer()
          useBootLoopStore.getState().reset()
          ringRef.current = []
          return
        }
      }

      // Generic line — push into the ring, cap from the front.
      const line: CapturedLine = {
        level: payload.level,
        tag: payload.tag,
        message: payload.message,
        timestampMs: Date.now(),
      }
      ringRef.current.push(line)
      if (ringRef.current.length > CONTEXT_LINES) {
        ringRef.current.splice(0, ringRef.current.length - CONTEXT_LINES)
      }
    }

    window.ipc.on(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)

    return () => {
      window.ipc.off(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)
      clearQuietTimer()
    }
  }, [connected, portPath, simulationMode])
}
