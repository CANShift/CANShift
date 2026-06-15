import type { ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'

const GITHUB_OWNER = 'tburkhalterr'
const GITHUB_REPO = 'CANShift'
const RELEASES_PAGE_SIZE = 10
const FETCH_TIMEOUT_MS = 8_000
const MERGED_ASSET_SUFFIX = '-merged.bin'
const FIRMWARE_ASSET_SUFFIX = '-firmware.bin'

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type?: string
  digest?: string | null
}

interface GitHubRelease {
  tag_name: string
  name: string | null
  prerelease: boolean
  published_at: string
  body: string | null
  html_url: string
  assets: GitHubAsset[]
}

const isAsset = (value: unknown): value is GitHubAsset => {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  if (typeof a.name !== 'string') return false
  if (typeof a.browser_download_url !== 'string') return false
  if (typeof a.size !== 'number' || !Number.isFinite(a.size)) return false
  if (a.content_type !== undefined && typeof a.content_type !== 'string') return false
  if (a.digest !== undefined && a.digest !== null && typeof a.digest !== 'string') return false
  return true
}

const isRelease = (value: unknown): value is GitHubRelease => {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  if (typeof r.tag_name !== 'string') return false
  if (r.name !== null && typeof r.name !== 'string') return false
  if (typeof r.prerelease !== 'boolean') return false
  if (typeof r.published_at !== 'string') return false
  if (r.body !== null && typeof r.body !== 'string') return false
  if (typeof r.html_url !== 'string') return false
  if (!Array.isArray(r.assets)) return false
  return true
}

const toReleaseInfo = (raw: GitHubRelease): ReleaseInfo => {
  const assets: ReleaseAsset[] = raw.assets.filter(isAsset).map((a) => ({
    name: a.name,
    downloadUrl: a.browser_download_url,
    sizeBytes: a.size,
    ...(a.content_type !== undefined ? { contentType: a.content_type } : {}),
    ...(a.digest !== undefined ? { digest: a.digest } : {}),
  }))
  return {
    version: raw.tag_name.replace(/^v/, ''),
    tag: raw.tag_name,
    name: raw.name,
    notes: raw.body ?? '',
    publishedAt: raw.published_at,
    prerelease: raw.prerelease,
    htmlUrl: raw.html_url,
    assets,
  }
}

export type ReleaseFetchError =
  | { kind: 'rate-limited'; message: string }
  | { kind: 'http-error'; status: number; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'invalid'; message: string }

export class ReleaseFetchFailed extends Error {
  readonly detail: ReleaseFetchError
  constructor(detail: ReleaseFetchError) {
    super(detail.message)
    this.name = 'ReleaseFetchFailed'
    this.detail = detail
  }
}

const isAbortError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  return /aborted|timeout/i.test(err.message)
}

export const fetchReleases = async (): Promise<ReleaseInfo[]> => {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${String(RELEASES_PAGE_SIZE)}`
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: controller.signal,
    })
  } catch (err) {
    const message = isAbortError(err)
      ? 'GitHub request timed out'
      : err instanceof Error
        ? err.message
        : 'Network unreachable'
    throw new ReleaseFetchFailed({ kind: 'offline', message })
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 403 || response.status === 429) {
    throw new ReleaseFetchFailed({
      kind: 'rate-limited',
      message: `GitHub rate limit reached (HTTP ${String(response.status)}). Try again later.`,
    })
  }

  if (!response.ok) {
    throw new ReleaseFetchFailed({
      kind: 'http-error',
      status: response.status,
      message: `GitHub returned HTTP ${String(response.status)}`,
    })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ReleaseFetchFailed({ kind: 'invalid', message: 'GitHub response was not valid JSON' })
  }
  if (!Array.isArray(payload)) {
    throw new ReleaseFetchFailed({ kind: 'invalid', message: 'GitHub response was not an array' })
  }
  return payload.filter(isRelease).map(toReleaseInfo)
}

export const findMergedAsset = (release: ReleaseInfo): ReleaseAsset | null =>
  release.assets.find((a) => a.name.endsWith(MERGED_ASSET_SUFFIX)) ?? null

export const findFirmwareAsset = (release: ReleaseInfo): ReleaseAsset | null =>
  release.assets.find(
    (a) => a.name.endsWith(FIRMWARE_ASSET_SUFFIX) && !a.name.endsWith(MERGED_ASSET_SUFFIX)
  ) ?? null
