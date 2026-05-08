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

const GITHUB_OWNER = 'tburkhalterr'
const GITHUB_REPO = 'CANShift'
const FIRMWARE_ASSET_RE = /canshift-firmware-.*-crowpanel_28-merged\.bin$/
const SPIFFS_ASSET_RE = /canshift-spiffs-.*-crowpanel_28\.bin$/

export interface FirmwareRelease {
  version: string
  tag: string
  /** Undefined when the firmware binary asset is absent from this release. */
  downloadUrl?: string
  /** Undefined when the SPIFFS image asset is absent from this release. */
  spiffsUrl?: string
  /**
   * Size of the firmware binary asset in bytes (from GitHub `assets[].size`).
   * Used to render an estimated flash duration in the studio UI without an
   * extra HEAD request. Undefined when the asset is missing.
   */
  payloadBytes?: number
  publishedAt: string
  prerelease: boolean
  notes: string
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
   * native serialport library. Mirrors esptool's "default_reset" sequence
   * (D0 R1 W100 D1 R0 W50 D0) but runs in the main process so macOS doesn't
   * fight us on Web Serial's setSignals throttling.
   *
   * Always closes the port before returning so the renderer's Web Serial can
   * grab it without an "already open" error. Errors are non-fatal — esptool-js
   * will fall back to its own (less reliable) reset attempt and pretend
   * nothing happened.
   *
   * Convention on the ESP32 auto-program circuit:
   *   DTR=true  → IO0 LOW (boot pin pulled low — enter download mode)
   *   DTR=false → IO0 HIGH (release boot pin)
   *   RTS=true  → EN LOW  (chip held in reset)
   *   RTS=false → EN HIGH (release reset)
   */
  async resetIntoBootloader(portPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const port = new SerialPort({
        path: portPath,
        baudRate: 115200,
        autoOpen: false,
      })
      const fail = (err: Error | null | undefined): void => {
        // Best-effort close, then surface the error
        port.close(() => {
          /* swallow */
        })
        resolve({
          success: false,
          error: err?.message ?? 'Failed to reset device into bootloader',
        })
      }
      port.open((err) => {
        if (err) {
          resolve({
            success: false,
            error: `Open ${portPath} failed: ${err.message}`,
          })
          return
        }
        const setSignals = (signals: { dtr: boolean; rts: boolean }, cb: () => void): void => {
          port.set(signals, (setErr) => {
            if (setErr) {
              fail(setErr)
              return
            }
            cb()
          })
        }
        const sleep = (ms: number, cb: () => void): void => {
          setTimeout(cb, ms)
        }
        // D0 R1 — release boot, hold reset
        setSignals({ dtr: false, rts: true }, () => {
          sleep(100, () => {
            // D1 R0 — pull boot LOW, release reset (chip enters bootloader)
            setSignals({ dtr: true, rts: false }, () => {
              sleep(50, () => {
                // D0 — release boot pin (chip stays in bootloader)
                setSignals({ dtr: false, rts: false }, () => {
                  port.close((closeErr) => {
                    if (closeErr) {
                      // Closing failed but the reset itself worked — log
                      // upstream by surfacing as success with caveat.
                      resolve({ success: true, error: `close: ${closeErr.message}` })
                      return
                    }
                    resolve({ success: true })
                  })
                })
              })
            })
          })
        })
      })
    })
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
      chunks.push(value)
      received += value.length
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
