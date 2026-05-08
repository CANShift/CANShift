// useFirmwareCheck.ts — Probes device firmware version after each connection.
//
// On connect:
//   - Sends CMD_GET_STATUS to the device (2s timeout).
//   - If no response → retry once after a short delay to absorb a transient
//     post-flash reboot timeout. Only after the second miss do we conclude the
//     device has no CANShift firmware and open the flash dialog.
//   - If version received → store it; compare with latest GitHub release
//     → if outdated → open update dialog.
//
// Reconnects to the same port (e.g. after a reboot following a successful
// flash) skip the probe entirely — the version was already validated for that
// port. The check is also suppressed while a flash is in flight (#215).
//
// This hook must be mounted once at the app root (App.tsx).

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareRelease } from '../services/ipc.service'

// Delay between the first failed probe and the retry. Long enough to clear a
// post-reboot CMD_GET_STATUS timeout, short enough to keep the UI responsive.
const POST_TIMEOUT_RETRY_DELAY_MS = 1_500

function compareSemver(a: string, b: string): number {
  const parse = (s: string) => s.split('.').map((n) => parseInt(n, 10))
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return (aMaj ?? 0) - (bMaj ?? 0)
  if (aMin !== bMin) return (aMin ?? 0) - (bMin ?? 0)
  return (aPat ?? 0) - (bPat ?? 0)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useFirmwareCheck(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const flashing = useDeviceStore((s) => s.flashing)
  const setFirmwareVersion = useDeviceStore((s) => s.setFirmwareVersion)
  const setFirmwareDialog = useDeviceStore((s) => s.setFirmwareDialog)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const setSdState = useDeviceStore((s) => s.setSdState)

  // Last portPath we successfully probed. Reconnects to the same port skip the
  // check so a post-flash reboot doesn't re-prompt the flash dialog (#215).
  const checkedPortRef = useRef<string | null>(null)
  // Tracks the port the in-flight probe targets so stale results from an older
  // port are ignored when the user swaps cables mid-probe.
  const inFlightPortRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset the latch when the device is gone so the next fresh connect probes.
    if (!connected || !portPath || simulationMode) {
      checkedPortRef.current = null
      inFlightPortRef.current = null
      return
    }

    // Don't probe while a flash is running — esptool-js owns the port.
    if (flashing) return

    // Already validated this port (e.g. reconnect after reboot) — bail out.
    if (checkedPortRef.current === portPath) return

    const currentPort = portPath
    inFlightPortRef.current = currentPort

    let cancelled = false

    async function run(): Promise<void> {
      // 1. Query device version. queryVersion() does not throw on timeout —
      // it resolves with { version: null }. A single null can be a transient
      // boot-time miss after a successful flash, so retry once before giving up.
      let { version, isDay, sdState } = await firmwareIpc.queryVersion()

      if (cancelled || inFlightPortRef.current !== currentPort) return

      if (!version) {
        await sleep(POST_TIMEOUT_RETRY_DELAY_MS)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled || inFlightPortRef.current !== currentPort) return
        ;({ version, isDay, sdState } = await firmwareIpc.queryVersion())
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled || inFlightPortRef.current !== currentPort) return
      }

      if (!version) {
        // Two consecutive misses — the device genuinely has no CANShift firmware.
        setFirmwareVersion(null)
        setFirmwareDialog({ visible: true, mode: 'flash' })
        return
      }

      checkedPortRef.current = currentPort
      setFirmwareVersion(version)
      setIsDayMode(isDay)
      setSdState(sdState)

      // 2. Check for updates against stable releases (best-effort — ignore errors)
      let releases: FirmwareRelease[]
      try {
        releases = await firmwareIpc.listReleases('stable')
      } catch {
        // Network unavailable — skip update check silently
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled || inFlightPortRef.current !== currentPort) return

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
  }, [
    connected,
    portPath,
    simulationMode,
    flashing,
    setFirmwareVersion,
    setFirmwareDialog,
    setIsDayMode,
    setSdState,
  ])
}
