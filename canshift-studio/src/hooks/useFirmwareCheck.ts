// useFirmwareCheck.ts — Probes device firmware version after each connection
// and writes the discriminated `firmwareCheck` slice on the device store.
//
// On connect:
//   - Sends CMD_GET_STATUS to the device (per-attempt timeout in usb.service).
//   - If no response → retry up to PROBE_MAX_ATTEMPTS times with backoff to
//     absorb the post-flash boot window. The runtime-fonts boot path (#453)
//     pushed `taskUSBComm` initialisation past the previous 5.5 s budget,
//     so the probe declared "no firmware" while the device was still booting
//     (#485).
//   - If a `[BOOT] CANShift vX.Y.Z starting` line shows up on the wire while
//     the probe is still retrying, we accept the embedded version directly —
//     the firmware emits it from `setup()` before the USB task is up, so
//     it's the earliest reliable version signal we can observe. `isDay` stays
//     unknown in that branch; the caller's per-port latch keeps a follow-up
//     CMD_GET_STATUS from re-running on the same reconnect.
//   - If a version is received → store it; compare against the latest GitHub
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
import { useLogStore } from '../stores/log.store'
import type { LogLevel } from '../stores/log.store'
import { firmwareIpc } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import type { FirmwareRelease, FirmwareStatus } from '../services/ipc.service'

/**
 * Backoff delays (ms) inserted BEFORE attempts 2..N. Length defines the
 * total number of retry waits — see `PROBE_MAX_ATTEMPTS` for the attempt
 * count. Tuned so a healthy boot lands inside attempt 2 while still tolerating
 * the slow runtime-fonts path.
 */
export const PROBE_BACKOFF_MS = [1_000, 1_500, 2_500] as const

/** Maximum number of CMD_GET_STATUS attempts before giving up. */
export const PROBE_MAX_ATTEMPTS = PROBE_BACKOFF_MS.length + 1

/**
 * Backwards-compatible alias for the first retry delay. Kept exported so
 * existing consumers (and `useFirmwareCheck.test.ts`) keep compiling without
 * needing to track the new backoff array directly.
 */
export const POST_TIMEOUT_RETRY_DELAY_MS = PROBE_BACKOFF_MS[0]

/**
 * Pattern for the firmware's earliest boot-banner log message
 * (`LOG_INFO("BOOT", "CANShift v" APP_VERSION_STR " starting")`). Matched
 * against the formatted device-log entry the renderer emits, which is
 * `[device][BOOT] CANShift vX.Y.Z starting`.
 *
 * Exported so the boot-loop detector (`useBootLoopDetector`) can reuse the
 * same regex without parsing the boot banner twice (#498).
 */
export const BOOT_VERSION_RE = /\bCANShift v(\d+\.\d+\.\d+)\b/

interface DeviceLogPayload {
  level: string
  tag: string
  message: string
}

function isDeviceLogPayload(v: unknown): v is DeviceLogPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    'level' in v &&
    'tag' in v &&
    'message' in v &&
    typeof (v as { tag?: unknown }).tag === 'string' &&
    typeof (v as { message?: unknown }).message === 'string'
  )
}

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
export type ProbeLogger = (level: LogLevel, message: string) => void

export interface ProbeReport {
  setFirmwareCheck: (check: FirmwareCheck) => void
  setFirmwareVersion: (version: string | null) => void
  setIsDayMode: (isDay: boolean | null) => void
  /**
   * Optional sink for activity-log entries. The hook wires this to
   * `useLogStore.push`; tests can omit it for a silent run.
   */
  log?: ProbeLogger
  /**
   * Optional getter for the latest version observed on the firmware boot-log
   * stream (`CANShift vX.Y.Z starting`). When the CMD_GET_STATUS round-trip
   * fails but the boot log already named a version, we adopt it as a last
   * resort — `isDay` stays unknown in that case (#485).
   */
  getBootLogVersion?: () => string | null
}

export async function runFirmwareProbe(
  report: ProbeReport,
  isCancelled: () => boolean
): Promise<void> {
  const log: ProbeLogger = report.log ?? ((): void => undefined)
  const getBootVersion: () => string | null = report.getBootLogVersion ?? ((): null => null)
  report.setFirmwareCheck({ kind: 'probing' })

  log('info', '[status] Probing firmware version…')
  const startedAt = Date.now()

  // Attempt the probe up to PROBE_MAX_ATTEMPTS times. The first call has no
  // backoff in front of it; later attempts wait PROBE_BACKOFF_MS[i-1] first.
  let status: FirmwareStatus = { version: null, isDay: null }
  let waitedNotice = false
  for (let attempt = 0; attempt < PROBE_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      if (!waitedNotice) {
        log('info', '[status] Device booting — waiting for ready')
        waitedNotice = true
      }
      const backoff = PROBE_BACKOFF_MS[attempt - 1] ?? 0
      await sleep(backoff)
      if (isCancelled()) return
    }
    status = await firmwareIpc.queryVersion()
    if (isCancelled()) return
    if (status.version) break
  }

  const elapsedMs = Date.now() - startedAt

  if (!status.version) {
    // Probe never round-tripped. As a last resort, adopt a version we may
    // have captured from the boot-banner log line — that path doesn't go
    // through the USB command queue, so it can land while the firmware is
    // still bringing up `taskUSBComm`.
    const fromLog = getBootVersion()
    if (fromLog !== null) {
      report.setFirmwareVersion(fromLog)
      report.setIsDayMode(null)
      log(
        'info',
        `[status] Firmware v${fromLog} (boot log) — day=unknown (${String(elapsedMs)} ms)`
      )
      await classifyAgainstReleases(fromLog, report, isCancelled, log)
      return
    }

    report.setFirmwareVersion(null)
    report.setFirmwareCheck({ kind: 'no_firmware' })
    log('warn', `[status] No CANShift firmware detected (after ${String(elapsedMs)} ms)`)
    return
  }

  const version = status.version
  report.setFirmwareVersion(version)
  report.setIsDayMode(status.isDay)
  log(
    'info',
    `[status] Firmware v${version} — day=${status.isDay === null ? 'unknown' : String(status.isDay)} (${String(elapsedMs)} ms)`
  )

  await classifyAgainstReleases(version, report, isCancelled, log)
}

async function classifyAgainstReleases(
  version: string,
  report: ProbeReport,
  isCancelled: () => boolean,
  log: ProbeLogger
): Promise<void> {
  let releases: FirmwareRelease[]
  try {
    releases = await firmwareIpc.listReleases('stable')
  } catch (err) {
    if (isCancelled()) return
    const msg = err instanceof Error ? err.message : String(err)
    log('warn', `[status] Release server unreachable: ${msg} — assuming up to date`)
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
    log('info', `[status] Update available — v${latest.version} (current v${version})`)
  } else {
    report.setFirmwareCheck({ kind: 'up_to_date', version, checkedAt: Date.now() })
    log('info', `[status] Up to date — v${version}`)
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
  const log = useLogStore((s) => s.push)

  // Last portPath we successfully probed. Reconnects to the same port skip the
  // check so a post-flash reboot doesn't re-prompt the flash dialog (#215).
  const checkedPortRef = useRef<string | null>(null)
  // Tracks the port the in-flight probe targets so stale results from an older
  // port are ignored when the user swaps cables mid-probe.
  const inFlightPortRef = useRef<string | null>(null)
  // Last tick we acted on — bumped externally via requestFirmwareRecheck().
  const lastHandledTickRef = useRef(0)

  // Most recent version captured from the firmware boot-banner log line.
  // Populated by the listener below, consumed by the probe orchestrator as a
  // last-resort fallback when CMD_GET_STATUS never round-trips (#485).
  const bootLogVersionRef = useRef<string | null>(null)

  // Listen for the `[BOOT] CANShift vX.Y.Z starting` device log so the probe
  // can short-circuit when the device is still booting up its USB command
  // task. The listener is mounted unconditionally — it's a tiny cost compared
  // to the value of catching the version banner before `useFirmwareCheck`'s
  // effect re-runs on the connect transition.
  useEffect(() => {
    const handleDeviceLog = (payload: unknown): void => {
      if (!isDeviceLogPayload(payload)) return
      if (payload.tag !== 'BOOT') return
      const match = BOOT_VERSION_RE.exec(payload.message)
      if (!match?.[1]) return
      bootLogVersionRef.current = match[1]
    }
    window.ipc.on(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)
    return () => {
      window.ipc.off(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)
    }
  }, [])

  useEffect(() => {
    // Reset the latch when the device is gone so the next fresh connect probes.
    if (!connected || !portPath || simulationMode) {
      checkedPortRef.current = null
      inFlightPortRef.current = null
      // A fresh connect may bring a new device — drop the stale boot-log
      // version so it can't leak across boards.
      bootLogVersionRef.current = null
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
      log,
      getBootLogVersion: () => bootLogVersionRef.current,
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
    log,
  ])
}
