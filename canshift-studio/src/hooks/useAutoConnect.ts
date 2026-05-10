// useAutoConnect.ts — Continuous auto-connect to a CANShift device.
//
// On mount and every 2s while disconnected:
//   1. List serial ports.
//   2. Pick a candidate: last-known port if present, else a unique CH340/CP210x port.
//   3. Attempt connect.
//
// Disabled in simulation mode and while the firmware check is probing or a
// flash is in flight — both own the serial port and would race the connect.

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import type { PortInfo } from '@tmbk/canshift-core'
import { sessionIpc, usbService } from '../services/ipc.service'

const POLL_INTERVAL_MS = 2_000

// Rate-limit the "Auto-connected" success log. The hook re-runs every
// disconnect → reconnect transition, so a flash retry that bounces the port
// would otherwise spam the log between the flash-error entries (#35). Module
// scope so it persists across hook unmount/remount within the same session.
const RECONNECT_LOG_COOLDOWN_MS = 30_000
let lastAutoConnectLogAt = 0

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
  const probing = useDeviceStore((s) => s.firmwareCheck.kind === 'probing')
  // `flashing` covers UpdateRoute, which kicks off a flash directly from the
  // panel. Without this guard, the 2 s reconnect poll grabs the serial port
  // back from esptool-js mid-flash and the write times out.
  const flashing = useDeviceStore((s) => s.flashing)
  const setConnected = useDeviceStore((s) => s.setConnected)
  const log = useLogStore((s) => s.push)

  // Guard against re-entrant connect attempts while a previous one is still in flight
  const inFlight = useRef(false)

  useEffect(() => {
    if (connected || simulationMode || probing || flashing) return

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
          const now = Date.now()
          if (now - lastAutoConnectLogAt > RECONNECT_LOG_COOLDOWN_MS) {
            log('success', `Auto-connected to ${candidate.path}`)
            lastAutoConnectLogAt = now
          }
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
  }, [connected, simulationMode, probing, flashing, setConnected, log])
}
