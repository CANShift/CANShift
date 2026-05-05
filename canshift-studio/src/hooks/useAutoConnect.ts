// useAutoConnect.ts — Continuous auto-connect to a CANShift device.
//
// On mount and every 2s while disconnected:
//   1. List serial ports.
//   2. Pick a candidate: last-known port if present, else a unique CH340/CP210x port.
//   3. Attempt connect.
//
// Disabled in simulation mode and when the user is on the firmware flash dialog
// (which takes over the serial port via Web Serial).

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { sessionIpc, usbService } from '../services/ipc.service'
import type { PortInfo } from '../services/ipc.service'

const POLL_INTERVAL_MS = 2_000

// USB-to-UART chips used by the supported boards. Match against manufacturer
// strings reported by the OS — covers macOS, Windows and Linux variants.
const CANSHIFT_MANUFACTURER_HINTS = ['silicon labs', 'cp210', 'wch.cn', 'ch340', 'ch9102']

function isCanShiftPort(p: PortInfo): boolean {
  const m = p.manufacturer?.toLowerCase() ?? ''
  return CANSHIFT_MANUFACTURER_HINTS.some((hint) => m.includes(hint))
}

function pickCandidate(ports: PortInfo[], lastPortPath: string | null): PortInfo | null {
  if (lastPortPath) {
    const remembered = ports.find((p) => p.path === lastPortPath)
    if (remembered) return remembered
  }
  const matches = ports.filter(isCanShiftPort)
  return matches.length === 1 && matches[0] ? matches[0] : null
}

export function useAutoConnect(): void {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const flashDialogVisible = useDeviceStore((s) => s.firmwareDialog.visible)
  const setConnected = useDeviceStore((s) => s.setConnected)
  const log = useLogStore((s) => s.push)

  // Guard against re-entrant connect attempts while a previous one is still in flight
  const inFlight = useRef(false)

  useEffect(() => {
    if (connected || simulationMode || flashDialogVisible) return

    let cancelled = false

    const tryConnect = async (): Promise<void> => {
      if (cancelled || inFlight.current) return
      inFlight.current = true
      try {
        const [ports, lastPortPath] = await Promise.all([
          usbService.listPorts(),
          sessionIpc.getLastPortPath(),
        ])
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) return

        const candidate = pickCandidate(ports, lastPortPath)
        if (!candidate) return

        const result = await usbService.connect(candidate.path)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) return

        if (result.success) {
          setConnected(candidate.path)
          log('success', `Auto-connected to ${candidate.path}`)
        }
      } catch {
        // Best-effort — next tick will retry
      } finally {
        inFlight.current = false
      }
    }

    void tryConnect()
    const interval = setInterval(() => void tryConnect(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connected, simulationMode, flashDialogVisible, setConnected, log])
}
