// useFirmwareCheck.ts — Probes device firmware version after each connection
// and writes the discriminated `firmwareCheck` slice on the device store.
//
// On connect:
//   - Sends CMD_GET_STATUS to the device (2s timeout).
//   - If no response → retry once after a short delay to absorb a transient
//     post-flash reboot timeout. Only after the second miss do we conclude the
//     device has no CANShift firmware (`no_firmware`).
//   - If version received → store it; compare against the latest GitHub
//     release. `up_to_date` / `update_available` / `check_failed` accordingly.
//
// Reconnects to the same port (e.g. after a reboot following a successful
// flash) skip the probe entirely — the version was already validated for that
// port (#215). The check is also suppressed while a flash is in flight.
//
// Callers can force a re-probe via `requestFirmwareRecheck()` on the device
// store — the orchestrator listens on `firmwareCheckTick` and reruns even
// when the per-port latch is set.
//
// This hook must be mounted once at the app root (App.tsx).

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import type { FirmwareCheck } from '../stores/device.store'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareRelease, FirmwareStatus, SdRuntimeState } from '../services/ipc.service'

// Delay between the first failed probe and the retry. Long enough to clear a
// post-reboot CMD_GET_STATUS timeout, short enough to keep the UI responsive.
export const POST_TIMEOUT_RETRY_DELAY_MS = 1_500

function compareSemver(a: string, b: string): number {
  const parse = (s: string): number[] => s.split('.').map((n) => parseInt(n, 10))
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return (aMaj ?? 0) - (bMaj ?? 0)
  if (aMin !== bMin) return (aMin ?? 0) - (bMin ?? 0)
  return (aPat ?? 0) - (bPat ?? 0)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Pure orchestration of the version probe + release comparison. Exported so
 * the unit test can drive it directly without mounting a React tree. The
 * caller passes a `report` sink that mirrors the writes the React effect
 * would otherwise push into the device store, plus a `cancelled` callback
 * for cooperative cancellation when the port changes mid-probe.
 */
export interface ProbeReport {
  setFirmwareCheck: (check: FirmwareCheck) => void
  setFirmwareVersion: (version: string | null) => void
  setIsDayMode: (isDay: boolean | null) => void
  setSdState: (state: SdRuntimeState) => void
}

export async function runFirmwareProbe(
  report: ProbeReport,
  isCancelled: () => boolean
): Promise<void> {
  report.setFirmwareCheck({ kind: 'probing' })

  // 1. Query device version. queryVersion() does not throw on timeout —
  // it resolves with { version: null }. A single null can be a transient
  // boot-time miss after a successful flash, so retry once before giving up.
  let status: FirmwareStatus = await firmwareIpc.queryVersion()

  if (isCancelled()) return

  if (!status.version) {
    await sleep(POST_TIMEOUT_RETRY_DELAY_MS)
    if (isCancelled()) return
    status = await firmwareIpc.queryVersion()
    if (isCancelled()) return
  }

  if (!status.version) {
    // Two consecutive misses — the device genuinely has no CANShift firmware.
    report.setFirmwareVersion(null)
    report.setFirmwareCheck({ kind: 'no_firmware' })
    return
  }

  const version = status.version
  report.setFirmwareVersion(version)
  report.setIsDayMode(status.isDay)
  report.setSdState(status.sdState)

  // 2. Check for updates against stable releases. If the API throws we
  // fall back to `up_to_date` (best effort) so an offline studio doesn't
  // permanently flag the device as needing an update.
  let releases: FirmwareRelease[]
  try {
    releases = await firmwareIpc.listReleases('stable')
  } catch {
    if (isCancelled()) return
    report.setFirmwareCheck({ kind: 'up_to_date', version, checkedAt: Date.now() })
    return
  }

  if (isCancelled()) return

  const latest = releases[0]
  if (!latest) {
    report.setFirmwareCheck({ kind: 'up_to_date', version, checkedAt: Date.now() })
    return
  }

  if (compareSemver(latest.version, version) > 0) {
    report.setFirmwareCheck({
      kind: 'update_available',
      version,
      latestVersion: latest.version,
      checkedAt: Date.now(),
    })
  } else {
    report.setFirmwareCheck({ kind: 'up_to_date', version, checkedAt: Date.now() })
  }
}

export function useFirmwareCheck(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const flashing = useDeviceStore((s) => s.flashing)
  const tick = useDeviceStore((s) => s.firmwareCheckTick)
  const setFirmwareVersion = useDeviceStore((s) => s.setFirmwareVersion)
  const setFirmwareCheck = useDeviceStore((s) => s.setFirmwareCheck)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const setSdState = useDeviceStore((s) => s.setSdState)

  // Last portPath we successfully probed. Reconnects to the same port skip the
  // check so a post-flash reboot doesn't re-prompt the flash dialog (#215).
  const checkedPortRef = useRef<string | null>(null)
  // Tracks the port the in-flight probe targets so stale results from an older
  // port are ignored when the user swaps cables mid-probe.
  const inFlightPortRef = useRef<string | null>(null)
  // Last tick we acted on — bumped externally via requestFirmwareRecheck().
  const lastHandledTickRef = useRef(0)

  useEffect(() => {
    // Reset the latch when the device is gone so the next fresh connect probes.
    if (!connected || !portPath || simulationMode) {
      checkedPortRef.current = null
      inFlightPortRef.current = null
      return
    }

    // Don't probe while a flash is running — esptool-js owns the port.
    if (flashing) return

    const recheckRequested = tick !== lastHandledTickRef.current
    if (recheckRequested) {
      // Clear the latch so the probe runs even if we already validated this port.
      checkedPortRef.current = null
      lastHandledTickRef.current = tick
    }

    // Already validated this port (e.g. reconnect after reboot) — bail out.
    if (checkedPortRef.current === portPath) return

    const currentPort = portPath
    inFlightPortRef.current = currentPort

    let cancelled = false

    const report: ProbeReport = {
      setFirmwareCheck: (c) => {
        // A terminal result that confirmed the firmware (any non-probing,
        // non-no_firmware state) latches the port so we don't re-probe on a
        // reboot reconnect (#215).
        if (c.kind !== 'probing' && c.kind !== 'no_firmware') {
          checkedPortRef.current = currentPort
        }
        setFirmwareCheck(c)
      },
      setFirmwareVersion,
      setIsDayMode,
      setSdState,
    }

    void runFirmwareProbe(report, () => cancelled || inFlightPortRef.current !== currentPort)

    return () => {
      cancelled = true
    }
  }, [
    connected,
    portPath,
    simulationMode,
    flashing,
    tick,
    setFirmwareVersion,
    setFirmwareCheck,
    setIsDayMode,
    setSdState,
  ])
}
