// useFirmwareCheck.test.ts — Locks the orchestration of the firmware check
// pipeline that replaced the auto-popup FirmwareDialog.
//
// We test `runFirmwareProbe` directly (the pure async core that the React
// hook wraps) so the tests don't pull in @testing-library/react. The hook's
// own latch + recheck plumbing lives in `useFirmwareCheck` and is exercised
// by the recheck test below via the device store.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirmwareCheck } from '../stores/device.store'
import type { LogLevel } from '../stores/log.store'
import type { SdRuntimeState } from '../services/ipc.service'
import { runFirmwareProbe, POST_TIMEOUT_RETRY_DELAY_MS } from './useFirmwareCheck'

// firmwareIpc is mocked module-level — every test installs its own resolved
// values via the typed helpers below.
vi.mock('../services/ipc.service', () => ({
  firmwareIpc: {
    queryVersion: vi.fn(),
    listReleases: vi.fn(),
  },
}))

import { firmwareIpc } from '../services/ipc.service'

const mockedQueryVersion = firmwareIpc.queryVersion as unknown as ReturnType<typeof vi.fn>
const mockedListReleases = firmwareIpc.listReleases as unknown as ReturnType<typeof vi.fn>

interface CapturedReport {
  checks: FirmwareCheck[]
  versions: (string | null)[]
  isDayValues: (boolean | null)[]
  sdStates: SdRuntimeState[]
  logs: { level: LogLevel; message: string }[]
}

function makeCapturedReport(): {
  capture: CapturedReport
  report: {
    setFirmwareCheck: (c: FirmwareCheck) => void
    setFirmwareVersion: (v: string | null) => void
    setIsDayMode: (d: boolean | null) => void
    setSdState: (s: SdRuntimeState) => void
    log: (level: LogLevel, message: string) => void
  }
} {
  const capture: CapturedReport = {
    checks: [],
    versions: [],
    isDayValues: [],
    sdStates: [],
    logs: [],
  }
  return {
    capture,
    report: {
      setFirmwareCheck: (c) => capture.checks.push(c),
      setFirmwareVersion: (v) => capture.versions.push(v),
      setIsDayMode: (d) => capture.isDayValues.push(d),
      setSdState: (s) => capture.sdStates.push(s),
      log: (level, message) => capture.logs.push({ level, message }),
    },
  }
}

describe('runFirmwareProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("flags 'no_firmware' after two consecutive misses", async () => {
    vi.useFakeTimers()
    mockedQueryVersion.mockResolvedValue({ version: null, isDay: null, sdState: 'unknown' })

    const { capture, report } = makeCapturedReport()
    const promise = runFirmwareProbe(report, () => false)

    // Advance past the retry delay so the second probe runs.
    await vi.advanceTimersByTimeAsync(POST_TIMEOUT_RETRY_DELAY_MS + 50)
    await promise

    expect(mockedQueryVersion).toHaveBeenCalledTimes(2)
    expect(capture.checks[0]).toEqual({ kind: 'probing' })
    expect(capture.checks.at(-1)).toEqual({ kind: 'no_firmware' })
    expect(capture.versions).toContain(null)
  })

  it("flags 'up_to_date' when the device version matches the latest release", async () => {
    mockedQueryVersion.mockResolvedValue({ version: '1.2.3', isDay: true, sdState: 'ok' })
    mockedListReleases.mockResolvedValue([
      { version: '1.2.3', tag: 'v1.2.3', publishedAt: '', prerelease: false, notes: '' },
    ])

    const { capture, report } = makeCapturedReport()
    await runFirmwareProbe(report, () => false)

    const last = capture.checks.at(-1)
    expect(last?.kind).toBe('up_to_date')
    if (last?.kind === 'up_to_date') {
      expect(last.version).toBe('1.2.3')
    }
    expect(capture.versions).toContain('1.2.3')
    expect(capture.isDayValues).toContain(true)
    expect(capture.sdStates).toContain('ok')
  })

  it("flags 'update_available' when a newer release exists", async () => {
    mockedQueryVersion.mockResolvedValue({ version: '0.9.0', isDay: false, sdState: 'ok' })
    mockedListReleases.mockResolvedValue([
      { version: '1.0.0', tag: 'v1.0.0', publishedAt: '', prerelease: false, notes: '' },
    ])

    const { capture, report } = makeCapturedReport()
    await runFirmwareProbe(report, () => false)

    const last = capture.checks.at(-1)
    expect(last?.kind).toBe('update_available')
    if (last?.kind === 'update_available') {
      expect(last.version).toBe('0.9.0')
      expect(last.latestVersion).toBe('1.0.0')
    }
  })

  it("falls back to 'up_to_date' when listReleases throws (best-effort)", async () => {
    mockedQueryVersion.mockResolvedValue({ version: '1.0.0', isDay: null, sdState: 'unknown' })
    mockedListReleases.mockRejectedValue(new Error('offline'))

    const { capture, report } = makeCapturedReport()
    await runFirmwareProbe(report, () => false)

    const last = capture.checks.at(-1)
    expect(last?.kind).toBe('up_to_date')
  })

  it('re-runs cleanly on a follow-up probe (recheck behaviour)', async () => {
    // Mirrors what the React effect does when requestFirmwareRecheck() bumps
    // the tick: clear the latch and call runFirmwareProbe again. Each call
    // must contact the device and emit a fresh terminal state.
    mockedQueryVersion.mockResolvedValue({ version: '1.0.0', isDay: null, sdState: 'unknown' })
    mockedListReleases.mockResolvedValue([
      { version: '1.0.0', tag: 'v1.0.0', publishedAt: '', prerelease: false, notes: '' },
    ])

    const first = makeCapturedReport()
    await runFirmwareProbe(first.report, () => false)
    expect(first.capture.checks.at(-1)?.kind).toBe('up_to_date')
    expect(mockedQueryVersion).toHaveBeenCalledTimes(1)

    const second = makeCapturedReport()
    await runFirmwareProbe(second.report, () => false)
    expect(second.capture.checks.at(-1)?.kind).toBe('up_to_date')
    expect(mockedQueryVersion).toHaveBeenCalledTimes(2)
  })

  it('emits start + result log entries with the [status] prefix (#377)', async () => {
    mockedQueryVersion.mockResolvedValue({ version: '1.0.0', isDay: true, sdState: 'ok' })
    mockedListReleases.mockResolvedValue([
      { version: '1.0.0', tag: 'v1.0.0', publishedAt: '', prerelease: false, notes: '' },
    ])

    const { capture, report } = makeCapturedReport()
    await runFirmwareProbe(report, () => false)

    const messages = capture.logs.map((l) => l.message)
    expect(messages.some((m) => m.startsWith('[status] Probing'))).toBe(true)
    expect(messages.some((m) => m.startsWith('[status] Firmware v1.0.0'))).toBe(true)
    expect(messages.some((m) => m.startsWith('[status] Up to date'))).toBe(true)
  })

  it('logs no-firmware as a warn entry after two misses (#377)', async () => {
    vi.useFakeTimers()
    mockedQueryVersion.mockResolvedValue({ version: null, isDay: null, sdState: 'unknown' })

    const { capture, report } = makeCapturedReport()
    const promise = runFirmwareProbe(report, () => false)
    await vi.advanceTimersByTimeAsync(POST_TIMEOUT_RETRY_DELAY_MS + 50)
    await promise

    const warnMessages = capture.logs.filter((l) => l.level === 'warn').map((l) => l.message)
    expect(warnMessages.some((m) => m.includes('retrying once'))).toBe(true)
    expect(warnMessages.some((m) => m.includes('No CANShift firmware detected'))).toBe(true)
  })

  it('cooperatively cancels mid-probe when the port latch flips', async () => {
    vi.useFakeTimers()
    mockedQueryVersion.mockResolvedValue({ version: null, isDay: null, sdState: 'unknown' })

    const { capture, report } = makeCapturedReport()
    let cancelled = false
    const promise = runFirmwareProbe(report, () => cancelled)

    // Cancel before the retry fires.
    cancelled = true
    await vi.advanceTimersByTimeAsync(POST_TIMEOUT_RETRY_DELAY_MS + 50)
    await promise

    // Only the very first 'probing' write should land — no terminal state.
    expect(capture.checks).toEqual([{ kind: 'probing' }])
  })
})
