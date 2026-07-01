import { File, Paths } from 'expo-file-system'
import { z } from 'zod'
import { ReleaseInfoSchema } from '@tmbk/canshift-core'
import type { LatestReleaseResult, ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'

const GITHUB_OWNER = 'tburkhalterr'
const GITHUB_REPO = 'CANShift'

const CACHE_TTL_MS = 5 * 60 * 1000

const RELEASES_PAGE_SIZE = 20

const FETCH_TIMEOUT_MS = 8_000

const PERSISTENT_CACHE_FILENAME = 'releases-cache.json'

const MAX_RETRY_AFTER_MS = 60_000

const RETRY_BACKOFF_MS = 500

const GitHubAssetSchema = z.object({
  name: z.string(),
  browser_download_url: z.string(),
  size: z.number().finite(),
  content_type: z.string().optional(),
  digest: z.string().nullable().optional(),
})

const GitHubReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable(),
  prerelease: z.boolean(),
  published_at: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
  assets: z.array(z.unknown()),
})

type GitHubRelease = z.infer<typeof GitHubReleaseSchema>

const toReleaseInfo = (raw: GitHubRelease): ReleaseInfo => {
  const assets: ReleaseAsset[] = raw.assets.flatMap((value) => {
    const parsed = GitHubAssetSchema.safeParse(value)
    if (!parsed.success) return []
    const a = parsed.data
    return [
      {
        name: a.name,
        downloadUrl: a.browser_download_url,
        sizeBytes: a.size,
        ...(a.content_type !== undefined ? { contentType: a.content_type } : {}),
        ...(a.digest !== undefined ? { digest: a.digest } : {}),
      },
    ]
  })
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

const CachedPayloadSchema = z.object({
  release: ReleaseInfoSchema,
  prerelease: ReleaseInfoSchema.nullable(),
  fetchedAt: z.number().finite(),
})

type CachedPayload = z.infer<typeof CachedPayloadSchema>

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const isAbortError = (err: unknown): boolean => {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true
    return /aborted|timeout/i.test(err.message)
  }
  return false
}

const parseRetryAfterMs = (header: string | null): number => {
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

const loadPersistedCache = async (): Promise<CachedPayload | null> => {
  try {
    const file = new File(Paths.document, PERSISTENT_CACHE_FILENAME)
    if (!file.exists) return null
    const parsed = CachedPayloadSchema.safeParse(JSON.parse(await file.text()))
    if (!parsed.success) return null
    return parsed.data
  } catch {
    return null
  }
}

const savePersistedCache = (payload: CachedPayload): void => {
  try {
    const file = new File(Paths.document, PERSISTENT_CACHE_FILENAME)
    file.write(JSON.stringify(payload))
  } catch {
    void 0
  }
}

type FetchOutcome =
  | { kind: 'ok'; releases: GitHubRelease[] }
  | { kind: 'rate-limited'; retryAfterMs: number; message: string }
  | { kind: 'http-error'; status: number; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'invalid'; message: string }

const fetchReleasesOnce = async (): Promise<FetchOutcome> => {
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
  const releases = payload.flatMap((value): GitHubRelease[] => {
    const parsed = GitHubReleaseSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  })
  return { kind: 'ok', releases }
}

const fetchReleasesWithRetry = async (): Promise<FetchOutcome> => {
  const first = await fetchReleasesOnce()
  if (first.kind !== 'http-error' || first.status < 500) return first
  await sleep(RETRY_BACKOFF_MS)
  return fetchReleasesOnce()
}

const pickLatest = (
  releases: readonly GitHubRelease[]
): {
  stable: GitHubRelease | null
  prerelease: GitHubRelease | null
} => {
  const stable = releases.find((r) => !r.prerelease) ?? null
  const prerelease = releases.find((r) => r.prerelease) ?? null
  return { stable, prerelease }
}

export class ReleasesService {
  private cache: CachedPayload | null = null
  private rateLimitedUntil = 0
  private inFlight: Promise<LatestReleaseResult> | null = null
  private hydrationPromise: Promise<void> | null = null

  private readonly now: () => number

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? Date.now
  }

  private hydrate(): Promise<void> {
    if (this.hydrationPromise !== null) return this.hydrationPromise
    this.hydrationPromise = loadPersistedCache().then((persisted) => {
      if (persisted !== null && this.cache === null) {
        this.cache = persisted
      }
    })
    return this.hydrationPromise
  }

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
        const surfacePrerelease = stable !== null && prerelease !== null ? prerelease : null
        const payload: CachedPayload = {
          release: toReleaseInfo(release),
          prerelease: surfacePrerelease !== null ? toReleaseInfo(surfacePrerelease) : null,
          fetchedAt: nowMs,
        }
        this.cache = payload
        savePersistedCache(payload)
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

export const releasesService = new ReleasesService()
