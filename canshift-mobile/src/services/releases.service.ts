// releases.service.ts — Surface GitHub release info to the mobile UI.
//
// Issue #571 (mobile side; studio side landed in #597). Mobile talks to the
// GitHub REST API directly — there is no main-process indirection in React
// Native. The service mirrors the studio's `releases.service.ts` behaviour:
//
//   - in-memory cache with a 5-minute TTL,
//   - persistent cache hydration via `expo-file-system` so the screen can
//     show the last known release immediately on cold start,
//   - one retry on 5xx,
//   - honours `Retry-After` on 403/429,
//   - 8 s `AbortController` timeout per request,
//   - validates the response shape with a runtime type guard so a malformed
//     payload never reaches the UI as `any`.
//
// Errors are NEVER thrown across the boundary — every outcome is surfaced as
// a discriminated `LatestReleaseResult` so the UI can keep a single render
// path. Network details (status codes, error messages) are kept in the
// `message` field; secrets and stack traces are never embedded.

import * as FileSystem from 'expo-file-system'
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

/** Path for the persistent JSON cache file. Release payloads include GitHub
 *  release notes (markdown, can exceed SecureStore's 2048-byte limit — #610).
 *  Non-sensitive data; expo-file-system document directory is appropriate. */
const PERSISTENT_CACHE_PATH = `${FileSystem.documentDirectory ?? ''}releases-cache.json`

/** Cap the `Retry-After` honour window so a misconfigured server can't park
 *  the UI for hours. */
const MAX_RETRY_AFTER_MS = 60_000

/** Backoff between the initial 5xx attempt and the single retry. */
const RETRY_BACKOFF_MS = 500

// ---------------------------------------------------------------------------
// Network shapes (subset of the GitHub API response)
// ---------------------------------------------------------------------------

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

function isAsset(value: unknown): value is GitHubAsset {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  if (typeof a.name !== 'string') return false
  if (typeof a.browser_download_url !== 'string') return false
  if (typeof a.size !== 'number' || !Number.isFinite(a.size)) return false
  if (a.content_type !== undefined && typeof a.content_type !== 'string') return false
  return true
}

function isRelease(value: unknown): value is GitHubRelease {
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

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

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
    name: raw.name,
    notes: raw.body ?? '',
    publishedAt: raw.published_at,
    prerelease: raw.prerelease,
    htmlUrl: raw.html_url,
    assets,
  }
}

// ---------------------------------------------------------------------------
// Persistent cache shape (SecureStore)
// ---------------------------------------------------------------------------

interface PersistedPayload {
  release: ReleaseInfo
  prerelease: ReleaseInfo | null
  fetchedAt: number
}

interface CachedPayload {
  release: ReleaseInfo
  prerelease: ReleaseInfo | null
  fetchedAt: number
}

function isPersistedPayload(value: unknown): value is PersistedPayload {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  if (typeof p.fetchedAt !== 'number' || !Number.isFinite(p.fetchedAt)) return false
  if (!isReleaseInfo(p.release)) return false
  if (p.prerelease !== null && !isReleaseInfo(p.prerelease)) return false
  return true
}

function isReleaseInfo(value: unknown): value is ReleaseInfo {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  if (typeof r.version !== 'string') return false
  if (typeof r.tag !== 'string') return false
  if (r.name !== null && typeof r.name !== 'string') return false
  if (typeof r.notes !== 'string') return false
  if (typeof r.publishedAt !== 'string') return false
  if (typeof r.prerelease !== 'boolean') return false
  if (typeof r.htmlUrl !== 'string') return false
  if (!Array.isArray(r.assets)) return false
  return true
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Parse GitHub's `Retry-After` header (seconds or HTTP-date). Returns 0 when
 *  missing or malformed so the caller can fall through to the rate-limit error
 *  without an unbounded wait. */
function parseRetryAfterMs(header: string | null): number {
  if (header === null) return 0
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  }
  const date = Date.parse(header)
  if (!Number.isNaN(date)) {
    const delta = date - Date.now()
    return delta > 0 ? Math.min(delta, MAX_RETRY_AFTER_MS) : 0
  }
  return 0
}

// ---------------------------------------------------------------------------
// Persistent cache load / save (best-effort)
// ---------------------------------------------------------------------------

async function loadPersistedCache(): Promise<CachedPayload | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(PERSISTENT_CACHE_PATH)
    const parsed: unknown = JSON.parse(raw)
    if (!isPersistedPayload(parsed)) return null
    return {
      release: parsed.release,
      prerelease: parsed.prerelease,
      fetchedAt: parsed.fetchedAt,
    }
  } catch {
    // File not found on first launch, or corrupt payload — start fresh.
    return null
  }
}

async function savePersistedCache(payload: CachedPayload): Promise<void> {
  try {
    const persisted: PersistedPayload = {
      release: payload.release,
      prerelease: payload.prerelease,
      fetchedAt: payload.fetchedAt,
    }
    await FileSystem.writeAsStringAsync(PERSISTENT_CACHE_PATH, JSON.stringify(persisted))
  } catch {
    // Persistence is best-effort; the in-memory cache still works for the
    // current session.
  }
}

// ---------------------------------------------------------------------------
// Fetch primitive
// ---------------------------------------------------------------------------

type FetchOutcome =
  | { kind: 'ok'; releases: GitHubRelease[] }
  | { kind: 'rate-limited'; retryAfterMs: number; message: string }
  | { kind: 'http-error'; status: number; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'invalid'; message: string }

async function fetchReleasesOnce(): Promise<FetchOutcome> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${String(RELEASES_PAGE_SIZE)}`
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'CANShift-Mobile',
        Accept: 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    })
  } catch (err) {
    const message = isAbortError(err)
      ? 'Request to GitHub timed out'
      : err instanceof Error
        ? err.message
        : 'Network unreachable'
    return { kind: 'offline', message }
  } finally {
    clearTimeout(timer)
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
  await sleep(RETRY_BACKOFF_MS)
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

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export class ReleasesService {
  private cache: CachedPayload | null = null
  /** Earliest wall-clock time (ms) at which a new request may be sent. */
  private rateLimitedUntil = 0
  /** Concurrent callers share the same in-flight promise to avoid duplicate fetches. */
  private inFlight: Promise<LatestReleaseResult> | null = null
  /** Resolved once the persistent-cache hydration attempt has finished. */
  private hydrationPromise: Promise<void> | null = null

  /** Test seam — overrides `Date.now()` so cache TTL is deterministic. */
  private readonly now: () => number

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? Date.now
  }

  /** Lazily hydrate the in-memory cache from SecureStore. Idempotent — every
   *  caller awaits the same promise so we never deserialise twice. */
  private hydrate(): Promise<void> {
    if (this.hydrationPromise !== null) return this.hydrationPromise
    this.hydrationPromise = loadPersistedCache().then((persisted) => {
      if (persisted !== null && this.cache === null) {
        this.cache = persisted
      }
    })
    return this.hydrationPromise
  }

  /**
   * Returns the latest stable + latest prerelease, honouring the in-memory
   * cache and GitHub's rate-limit hint. Never throws — every failure mode is
   * surfaced as a discriminated `LatestReleaseResult`.
   */
  async getLatest(force = false): Promise<LatestReleaseResult> {
    await this.hydrate()

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
        const surfacePrerelease = stable !== null && prerelease !== null ? prerelease : null
        const payload: CachedPayload = {
          release: toReleaseInfo(release),
          prerelease: surfacePrerelease !== null ? toReleaseInfo(surfacePrerelease) : null,
          fetchedAt: nowMs,
        }
        this.cache = payload
        // Fire-and-forget — never block the UI on disk I/O.
        void savePersistedCache(payload)
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
      cached:
        cached !== null
          ? {
              release: cached.release,
              prerelease: cached.prerelease,
              fetchedAt: new Date(cached.fetchedAt).toISOString(),
            }
          : null,
    }
  }
}

/** Shared singleton — keeps the in-memory cache alive across screens. */
export const releasesService = new ReleasesService()
