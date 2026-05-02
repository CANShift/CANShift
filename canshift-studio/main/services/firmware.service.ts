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

export interface FirmwareRelease {
  version: string
  tag: string
  /** Undefined when the firmware binary asset is absent from this release. */
  downloadUrl?: string
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

      const asset = item.assets.filter(isAsset).find((a) => FIRMWARE_ASSET_RE.test(a.name))

      releases.push({
        version: item.tag_name.replace(/^v/, ''),
        tag: item.tag_name,
        ...(asset ? { downloadUrl: asset.browser_download_url } : {}),
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
}

export const firmwareService = new FirmwareService()
