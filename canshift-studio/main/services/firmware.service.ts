// firmware.service.ts — Firmware release management and flash-mode coordination
//
// Responsibilities:
//   - Fetch firmware releases from GitHub Releases API
//   - Track which serial port the renderer is about to flash (for Web Serial auto-select)
//   - Run the ESP32 BOOT-mode reset sequence from the main process before
//     handing the port to esptool-js (#196). Web Serial's setSignals on macOS
//     CH340 drivers is too flaky to drive the chip into download mode
//     reliably; the Node serialport library talks straight to the kernel
//     driver and is fast/sequential enough that the auto-program circuit
//     latches every time, no BOOT button press required.
//
// Actual binary download and flashing happens in the renderer (esptool-js + Web Serial API).

import { net } from 'electron'
import { SerialPort } from 'serialport'
import type { FirmwareRelease } from '../../shared/firmware.service.types'

const GITHUB_OWNER = 'tburkhalterr'
const GITHUB_REPO = 'CANShift'
const FIRMWARE_ASSET_RE = /canshift-firmware-.*-crowpanel_28-merged\.bin$/
const SPIFFS_ASSET_RE = /canshift-spiffs-.*-crowpanel_28\.bin$/

// ---------------------------------------------------------------------------
// Reset sequence (#482)
// ---------------------------------------------------------------------------

/** Strategy for driving DTR/RTS to enter the ESP32 ROM bootloader. */
export type ResetVariant = 'classic' | 'inverted' | 'usb-jtag'

interface ResetStep {
  readonly signals: { dtr: boolean; rts: boolean }
  /** Wait after asserting these signals before the next step. */
  readonly waitMs: number
}

// Widened from the original esptool defaults (100 / 50 ms) — slow CH340
// boards on macOS need extra latch time on the boot pin (#482).
const CLASSIC_RESET_STEPS: readonly ResetStep[] = [
  // D0 R1 — release boot, hold reset
  { signals: { dtr: false, rts: true }, waitMs: 120 },
  // D1 R0 — pull boot LOW, release reset (chip enters bootloader)
  { signals: { dtr: true, rts: false }, waitMs: 80 },
  // D0 R0 — release boot pin (chip stays in bootloader)
  { signals: { dtr: false, rts: false }, waitMs: 0 },
]

// Inverted variant — RTS toggles the boot pin, DTR toggles reset. Some
// FTDI/PL2303 wirings differ from the canonical CH340 layout.
const INVERTED_RESET_STEPS: readonly ResetStep[] = [
  { signals: { dtr: true, rts: false }, waitMs: 120 },
  { signals: { dtr: false, rts: true }, waitMs: 80 },
  { signals: { dtr: false, rts: false }, waitMs: 0 },
]

// USB-JTAG (ESP32-S3 native USB) — a single brief reset pulse, no boot pin.
const USB_JTAG_RESET_STEPS: readonly ResetStep[] = [
  { signals: { dtr: false, rts: true }, waitMs: 100 },
  { signals: { dtr: false, rts: false }, waitMs: 0 },
]

function resetSequenceFor(variant: ResetVariant): readonly ResetStep[] {
  switch (variant) {
    case 'classic':
      return CLASSIC_RESET_STEPS
    case 'inverted':
      return INVERTED_RESET_STEPS
    case 'usb-jtag':
      return USB_JTAG_RESET_STEPS
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }
}

/** Settle window between the two reset passes (#482). */
const RESET_PASS_GAP_MS = 250

/**
 * Hard ceiling for `downloadText` payloads (#671). The expected `.sha256`
 * sibling is 64 hex chars + optional filename — well under 1 KiB. 64 KiB
 * gives ample headroom while keeping a misconfigured CDN from streaming a
 * large body through main.
 */
const FIRMWARE_TEXT_MAX_BYTES = 64 * 1024

/**
 * Hard ceiling for `downloadBinary` payloads (#879). Current merged firmware
 * images are ~1.5 MiB; 16 MiB gives ~10× headroom while preventing a hostile
 * mirror (or a renderer with code execution) from streaming a multi-GB body
 * through main and OOMing the process.
 */
const FIRMWARE_BINARY_MAX_BYTES = 16 * 1024 * 1024

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// ---------------------------------------------------------------------------
// GitHub API type guards
// ---------------------------------------------------------------------------

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  prerelease: boolean
  published_at: string
  body: string | null
  assets: GitHubAsset[]
}

function isAsset(v: unknown): v is GitHubAsset {
  const a = v as Record<string, unknown>
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof a.name === 'string' &&
    typeof a.browser_download_url === 'string' &&
    typeof a.size === 'number'
  )
}

function isRelease(v: unknown): v is GitHubRelease {
  const r = v as Record<string, unknown>
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof r.tag_name === 'string' &&
    typeof r.prerelease === 'boolean' &&
    typeof r.published_at === 'string' &&
    Array.isArray(r.assets)
  )
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FirmwareService {
  /** Port path that the renderer is about to flash — used by Web Serial auto-select. */
  private flashPortPath: string | null = null

  /**
   * Fetch firmware releases from GitHub.
   * channel 'stable' → only non-prerelease releases.
   * channel 'beta'   → all releases (stable + prerelease).
   */
  async listReleases(channel: 'stable' | 'beta'): Promise<FirmwareRelease[]> {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'CANShift-Studio',
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      throw new Error('GitHub API returned ' + String(response.status))
    }

    const raw = (await response.json()) as unknown[]
    const releases: FirmwareRelease[] = []

    for (const item of raw) {
      if (!isRelease(item)) continue
      if (channel === 'stable' && item.prerelease) continue

      const assets = item.assets.filter(isAsset)
      const fwAsset = assets.find((a) => FIRMWARE_ASSET_RE.test(a.name))
      const spiffsAsset = assets.find((a) => SPIFFS_ASSET_RE.test(a.name))

      releases.push({
        version: item.tag_name.replace(/^v/, ''),
        tag: item.tag_name,
        ...(fwAsset ? { downloadUrl: fwAsset.browser_download_url } : {}),
        ...(spiffsAsset ? { spiffsUrl: spiffsAsset.browser_download_url } : {}),
        ...(fwAsset ? { payloadBytes: fwAsset.size } : {}),
        publishedAt: item.published_at,
        prerelease: item.prerelease,
        notes: item.body ?? '',
      })
    }

    return releases
  }

  setFlashPort(portPath: string | null): void {
    this.flashPortPath = portPath
  }

  getFlashPort(): string | null {
    return this.flashPortPath
  }

  /**
   * Hardware-reset the ESP32 into download mode by toggling DTR/RTS via the
   * native serialport library. Mirrors esptool's "default_reset" sequence but
   * runs in the main process so macOS doesn't fight us on Web Serial's
   * setSignals throttling.
   *
   * Two-pass strategy (#482): some CH340 boards miss the boot-pin sample on
   * the first attempt — particularly right after a USB replug. Running the
   * classic sequence twice with widened timings catches the slow boards
   * without penalising healthy ones.
   *
   * Always closes the port between passes so the renderer's Web Serial can
   * grab it without an "already open" error. The first pass's outcome is
   * authoritative — if it fails, the call surfaces that error. The second
   * pass is best-effort: its failure is logged via the `error` field but
   * `success` stays true.
   *
   * Convention on the ESP32 auto-program circuit:
   *   DTR=true  → IO0 LOW (boot pin pulled low — enter download mode)
   *   DTR=false → IO0 HIGH (release boot pin)
   *   RTS=true  → EN LOW  (chip held in reset)
   *   RTS=false → EN HIGH (release reset)
   */
  async resetIntoBootloader(portPath: string): Promise<{ success: boolean; error?: string }> {
    const first = await this.runResetSequence(portPath, 'classic')
    if (!first.success) {
      // First-pass failure (open / serial error) — surface it directly.
      return first
    }
    // Settle window between passes — long enough for the chip to fully boot
    // into ROM and for any USB-CDC re-enumeration to finish on macOS CH340.
    await sleepMs(RESET_PASS_GAP_MS)
    const second = await this.runResetSequence(portPath, 'classic')
    if (!second.success) {
      return {
        success: true,
        error: `2nd pass failed: ${second.error ?? 'unknown'}`,
      }
    }
    if (second.error) {
      return { success: true, error: `2nd pass: ${second.error}` }
    }
    return first
  }

  /**
   * One full reset attempt with the requested signal variant. Variants:
   *   - `classic`   — D0 R1 wait → D1 R0 wait → D0 R0 (CH340 / CP210x USB-CDC)
   *   - `inverted`  — RTS/DTR swapped; some FTDI cables in odd wirings
   *   - `usb-jtag`  — single-step pulse for ESP32-S3 native USB-JTAG
   *
   * Only `classic` is invoked from `resetIntoBootloader` today — the other
   * two are coded for a future per-port "bootloader entry mode" setting
   * (deferred from #482).
   */
  private runResetSequence(
    portPath: string,
    variant: ResetVariant
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const port = new SerialPort({
        path: portPath,
        baudRate: 115200,
        autoOpen: false,
      })
      port.open((err) => {
        if (err) {
          resolve({
            success: false,
            error: `Open ${portPath} failed: ${err.message}`,
          })
          return
        }
        const setSignals = (
          signals: { dtr: boolean; rts: boolean },
          cb: () => void,
          onError: (e: Error) => void
        ): void => {
          port.set(signals, (setErr) => {
            if (setErr) {
              onError(setErr)
              return
            }
            cb()
          })
        }
        const sleep = (ms: number, cb: () => void): void => {
          setTimeout(cb, ms)
        }
        const fail = (e: Error): void => {
          // Best-effort close, then surface the error.
          port.close(() => {
            /* swallow */
          })
          resolve({
            success: false,
            error: e.message,
          })
        }
        const finish = (): void => {
          port.close((closeErr) => {
            if (closeErr) {
              resolve({ success: true, error: `close: ${closeErr.message}` })
              return
            }
            resolve({ success: true })
          })
        }
        const steps = resetSequenceFor(variant)
        // Walk the (signals, waitMs) script in order — every step calls the
        // next via continuation so timing stays sequential without unbounded
        // promise chains in the failure path.
        const runStep = (i: number): void => {
          if (i >= steps.length) {
            finish()
            return
          }
          const step = steps[i]
          if (!step) {
            finish()
            return
          }
          setSignals(
            step.signals,
            () => {
              sleep(step.waitMs, () => {
                runStep(i + 1)
              })
            },
            fail
          )
        }
        runStep(0)
      })
    })
  }

  /**
   * Download a small text sibling (e.g. `firmware.bin.sha256`) — used to fetch
   * the expected checksum before flashing (#671). Capped at
   * `FIRMWARE_TEXT_MAX_BYTES` so a hostile mirror can't stream an unbounded
   * body. The same URL allowlist as the binary path applies at the IPC layer.
   */
  async downloadText(url: string): Promise<string> {
    const response = await net.fetch(url, {
      headers: { 'User-Agent': 'CANShift-Studio' },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error('HTTP ' + String(response.status))
    }

    const body = response.body
    if (!body) throw new Error('No response body')

    const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>
    let received = 0
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > FIRMWARE_TEXT_MAX_BYTES) {
        await reader.cancel().catch(() => {
          /* best-effort */
        })
        throw new Error(
          `Response exceeds ${String(FIRMWARE_TEXT_MAX_BYTES)} bytes — refusing to read further`
        )
      }
      chunks.push(value)
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(merged)
  }

  /**
   * Download a firmware binary in the main process.
   * Avoids the renderer-side CORS block on GitHub release CDN (objects.githubusercontent.com
   * doesn't set Access-Control-Allow-Origin).
   */
  async downloadBinary(
    url: string,
    onProgress: (received: number, total: number) => void
  ): Promise<ArrayBuffer> {
    const response = await net.fetch(url, {
      headers: { 'User-Agent': 'CANShift-Studio' },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error('HTTP ' + String(response.status))
    }

    const total = parseInt(response.headers.get('content-length') ?? '0', 10)
    const body = response.body
    if (!body) throw new Error('No response body')

    const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>
    const chunks: Uint8Array[] = []
    let received = 0

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > FIRMWARE_BINARY_MAX_BYTES) {
        await reader.cancel().catch(() => {
          /* best-effort */
        })
        throw new Error(
          `Response exceeds ${String(FIRMWARE_BINARY_MAX_BYTES)} bytes — refusing to read further`
        )
      }
      chunks.push(value)
      onProgress(received, total)
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return merged.buffer
  }
}

export const firmwareService = new FirmwareService()
