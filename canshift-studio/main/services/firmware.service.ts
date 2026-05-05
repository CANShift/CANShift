// firmware.service.ts — Firmware release management and flash-mode coordination
//
// Responsibilities:
//   - Fetch firmware releases from GitHub Releases API
//   - Track which serial port the renderer is about to flash (for Web Serial auto-select)
//
// Actual binary download and flashing happens in the renderer (esptool-js + Web Serial API).

import { net } from 'electron'

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
    typeof a.browser_download_url === 'string'
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
