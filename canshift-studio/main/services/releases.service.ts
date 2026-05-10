// releases.service.ts — Surface GitHub release info to the studio renderer.
//
// Issue #571: the studio (and later the mobile app) wants to show the user
// what the latest release on `tburkhalterr/CANShift` is, what changed, and
// which assets are attached. The network call lives in the main process for
// three reasons:
//   1. CORS — the renderer is sandboxed and the GitHub release CDN doesn't
//      set permissive CORS headers.
//   2. Single network surface — the CSP allowlists api.github.com only for
//      `connect-src` already, and routing everything through main keeps the
//      surface auditable.
//   3. Cache — keeping one in-memory cache in main avoids hammering the API
//      every time the user reopens the settings panel; renderer instances
//      that wake from sleep get instant cached data.
//
// The service intentionally returns a discriminated `LatestReleaseResult`
// shape (defined in canshift-core/types/releases.ts) — the renderer never
// sees raw GitHub objects, only a sanitised view. The renderer also gets a
// `fromCache` flag and a `cached` fallback on failure so the UI can show a
// stale value with a "Last checked: …" line when offline.
//
// Markdown bodies are kept as raw markdown here — `SafeMarkdown` in the
// renderer handles sanitisation. Unlike the auto-update path (which
// pre-flattens to plain text to protect callers that don't render through
// SafeMarkdown), this path always renders through the safe component.

import { net } from 'electron'
import type { LatestReleaseResult, ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'

const GITHUB_OWNER = 'tburkhalterr'
const GITHUB_REPO = 'CANShift'

/** TTL for the in-memory cache. Five minutes is comfortable below GitHub's
 *  unauthenticated rate limit of 60 req/h while still feeling live. */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Max number of releases to scan when looking for the latest pre-release. */
const RELEASES_PAGE_SIZE = 20

/** Total budget for an entire fetch attempt — bounds the user-facing latency. */
const FETCH_TIMEOUT_MS = 8_000

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type?: string
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

function isAsset(v: unknown): v is GitHubAsset {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  if (typeof a.name !== 'string') return false
  if (typeof a.browser_download_url !== 'string') return false
  if (typeof a.size !== 'number' || !Number.isFinite(a.size)) return false
  if (a.content_type !== undefined && typeof a.content_type !== 'string') return false
  return true
}

function isRelease(v: unknown): v is GitHubRelease {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (typeof r.tag_name !== 'string') return false
  if (r.name !== null && typeof r.name !== 'string') return false
  if (typeof r.prerelease !== 'boolean') return false
  if (typeof r.published_at !== 'string') return false
  if (r.body !== null && typeof r.body !== 'string') return false
  if (typeof r.html_url !== 'string') return false
  if (!Array.isArray(r.assets)) return false
  return true
}

function toReleaseInfo(raw: GitHubRelease): ReleaseInfo {
  const assets: ReleaseAsset[] = raw.assets.filter(isAsset).map((a) =>
    a.content_type !== undefined
      ? {
          name: a.name,
          downloadUrl: a.browser_download_url,
          sizeBytes: a.size,
          contentType: a.content_type,
        }
      : {
          name: a.name,
          downloadUrl: a.browser_download_url,
          sizeBytes: a.size,
        }
  )
  return {
    version: raw.tag_name.replace(/^v/, ''),
    tag: raw.tag_name,
    name: raw.name ?? null,
    notes: raw.body ?? '',
    publishedAt: raw.published_at,
    prerelease: raw.prerelease,
    htmlUrl: raw.html_url,
    assets,
  }
}

interface CachedPayload {
  release: ReleaseInfo
  prerelease: ReleaseInfo | null
  fetchedAt: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true
    return /aborted|timeout/i.test(err.message)
  }
  return false
}

/**
 * Wraps `net.fetch` with an AbortController-backed timeout. Electron's net
 * module honours signal abortion the same way the WHATWG `fetch` does.
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    return await net.fetch(url, {
      headers: {
        'User-Agent': 'CANShift-Studio',
        Accept: 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Honours GitHub's `Retry-After` header (seconds or HTTP-date) on 403/429
 * responses. Returns 0 when the header is missing or malformed so the caller
 * can fall straight through to the rate-limit error path.
 */
function parseRetryAfterMs(header: string | null): number {
  if (header === null) return 0
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000)
  const date = Date.parse(header)
  if (!Number.isNaN(date)) {
    const delta = date - Date.now()
    return delta > 0 ? Math.min(delta, 60_000) : 0
  }
  return 0
}

type FetchOutcome =
  | { kind: 'ok'; releases: GitHubRelease[] }
  | { kind: 'rate-limited'; retryAfterMs: number; message: string }
  | { kind: 'http-error'; status: number; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'invalid'; message: string }

/**
 * Fetches the releases list once. Retries 5xx once (the issue acceptance
 * criteria) but does NOT retry 4xx — those are deterministic. Treats network
 * failures as `offline`.
 */
async function fetchReleasesOnce(): Promise<FetchOutcome> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${String(RELEASES_PAGE_SIZE)}`
  let response: Response
  try {
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
  } catch (err) {
    const offlineMessage = isAbortError(err)
      ? 'Request to GitHub timed out'
      : err instanceof Error
        ? err.message
        : 'Network unreachable'
    return { kind: 'offline', message: offlineMessage }
  }

  if (response.status === 403 || response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
    return {
      kind: 'rate-limited',
      retryAfterMs,
      message: `GitHub rate limit reached (HTTP ${String(response.status)})`,
    }
  }

  if (!response.ok) {
    return {
      kind: 'http-error',
      status: response.status,
      message: `GitHub returned HTTP ${String(response.status)}`,
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { kind: 'invalid', message: 'GitHub response was not valid JSON' }
  }
  if (!Array.isArray(payload)) {
    return { kind: 'invalid', message: 'GitHub response was not an array' }
  }
  const releases = payload.filter(isRelease)
  return { kind: 'ok', releases }
}

/** Try once, retry exactly one more time on the 5xx branch (#571 AC). */
async function fetchReleasesWithRetry(): Promise<FetchOutcome> {
  const first = await fetchReleasesOnce()
  if (first.kind !== 'http-error' || first.status < 500) return first
  // Short pause to avoid hammering — 5xx is usually transient.
  await sleep(500)
  return fetchReleasesOnce()
}

function pickLatest(releases: readonly GitHubRelease[]): {
  stable: GitHubRelease | null
  prerelease: GitHubRelease | null
} {
  // GitHub returns releases sorted by `created_at` descending. The first
  // non-prerelease entry is the latest stable; the first prerelease entry
  // is the latest pre-release. We don't sort ourselves — trusting GitHub's
  // ordering keeps the behaviour aligned with their /releases/latest view.
  const stable = releases.find((r) => !r.prerelease) ?? null
  const prerelease = releases.find((r) => r.prerelease) ?? null
  return { stable, prerelease }
}

export class ReleasesService {
  private cache: CachedPayload | null = null
  /** Earliest wall-clock time (ms) at which a new request may be sent. */
  private rateLimitedUntil = 0
  /** Concurrent callers share the same in-flight promise to avoid duplicate fetches. */
  private inFlight: Promise<LatestReleaseResult> | null = null

  /** Test seam — overrides `Date.now()` so cache TTL is deterministic. */
  private readonly now: () => number

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? Date.now
  }

  /**
   * Returns the latest stable + latest prerelease, honouring the in-memory
   * cache and GitHub's rate-limit hint. Never throws — every failure mode is
   * surfaced as a discriminated `LatestReleaseResult`.
   */
  async getLatest(force = false): Promise<LatestReleaseResult> {
    const cached = this.cache
    const nowMs = this.now()

    if (!force && cached && nowMs - cached.fetchedAt < CACHE_TTL_MS) {
      return {
        ok: true,
        release: cached.release,
        prerelease: cached.prerelease,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        fromCache: true,
      }
    }

    if (this.inFlight) return this.inFlight

    if (nowMs < this.rateLimitedUntil) {
      return this.makeFailure('rate-limited', 'GitHub rate limit cooling down — try again shortly')
    }

    const promise = this.runFetch()
    this.inFlight = promise
    try {
      return await promise
    } finally {
      this.inFlight = null
    }
  }

  private async runFetch(): Promise<LatestReleaseResult> {
    const outcome = await fetchReleasesWithRetry()
    const nowMs = this.now()

    switch (outcome.kind) {
      case 'ok': {
        const { stable, prerelease } = pickLatest(outcome.releases)
        const release = stable ?? prerelease
        if (release === null) {
          return this.makeFailure('invalid-response', 'No releases published yet')
        }
        // Only surface `prerelease` separately when it's distinct from the
        // surfaced `release`. When no stable exists, the pre-release IS the
        // release — duplicating it under both fields would be misleading.
        const surfacePrerelease = stable !== null && prerelease !== null
        const payload: CachedPayload = {
          release: toReleaseInfo(release),
          prerelease: surfacePrerelease ? toReleaseInfo(prerelease) : null,
          fetchedAt: nowMs,
        }
        this.cache = payload
        return {
          ok: true,
          release: payload.release,
          prerelease: payload.prerelease,
          fetchedAt: new Date(payload.fetchedAt).toISOString(),
          fromCache: false,
        }
      }
      case 'rate-limited': {
        this.rateLimitedUntil = nowMs + outcome.retryAfterMs
        return this.makeFailure('rate-limited', outcome.message)
      }
      case 'http-error':
        return this.makeFailure('http-error', outcome.message)
      case 'offline':
        return this.makeFailure('offline', outcome.message)
      case 'invalid':
        return this.makeFailure('invalid-response', outcome.message)
      default: {
        const exhaustive: never = outcome
        return exhaustive
      }
    }
  }

  private makeFailure(
    reason: 'offline' | 'rate-limited' | 'http-error' | 'invalid-response',
    message: string
  ): LatestReleaseResult {
    const cached = this.cache
    const nowMs = this.now()
    return {
      ok: false,
      reason,
      message,
      fetchedAt: new Date(nowMs).toISOString(),
      cached: cached
        ? {
            release: cached.release,
            prerelease: cached.prerelease,
            fetchedAt: new Date(cached.fetchedAt).toISOString(),
          }
        : null,
    }
  }
}

export const releasesService = new ReleasesService()
