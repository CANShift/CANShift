// useFirmwareCheck.ts — Probes device firmware version after each connection.
//
// On connect:
//   - Sends CMD_GET_STATUS to the device (2s timeout).
//   - If no response → device has no CANShift firmware → open flash dialog.
//   - If version received → store it; compare with latest GitHub release
//     → if outdated → open update dialog.
//
// This hook must be mounted once at the app root (App.tsx).

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareRelease } from '../services/ipc.service'

function compareSemver(a: string, b: string): number {
  const parse = (s: string) => s.split('.').map((n) => parseInt(n, 10))
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return (aMaj ?? 0) - (bMaj ?? 0)
  if (aMin !== bMin) return (aMin ?? 0) - (bMin ?? 0)
  return (aPat ?? 0) - (bPat ?? 0)
}

export function useFirmwareCheck(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setFirmwareVersion = useDeviceStore((s) => s.setFirmwareVersion)
  const setFirmwareDialog = useDeviceStore((s) => s.setFirmwareDialog)

  // Track portPath at the time the check was launched so stale results are ignored
  const checkPortRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip in simulation mode or when not connected
    if (!connected || !portPath || simulationMode) return

    const currentPort = portPath
    checkPortRef.current = currentPort

    let cancelled = false as boolean

    async function run(): Promise<void> {
      // 1. Query device version
      const { version } = await firmwareIpc.queryVersion()

      if (cancelled || checkPortRef.current !== currentPort) return

      if (!version) {
        // No response — device has no CANShift firmware
        setFirmwareVersion(null)
        setFirmwareDialog({ visible: true, mode: 'flash' })
        return
      }

      setFirmwareVersion(version)

      // 2. Check for updates against stable releases (best-effort — ignore errors)
      let releases: FirmwareRelease[]
      try {
        releases = await firmwareIpc.listReleases('stable')
      } catch {
        // Network unavailable — skip update check silently
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled || checkPortRef.current !== currentPort) return

      const latest = releases[0]
      if (!latest) return

      if (compareSemver(latest.version, version) > 0) {
        setFirmwareDialog({ visible: true, mode: 'update' })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [connected, portPath, simulationMode, setFirmwareVersion, setFirmwareDialog])
}
