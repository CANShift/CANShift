export interface ReleaseAsset {
  name: string
  downloadUrl: string
  sizeBytes: number
  contentType?: string
  digest?: string | null
}

export interface ReleaseInfo {
  version: string
  tag: string
  name: string | null
  notes: string
  publishedAt: string
  prerelease: boolean
  htmlUrl: string
  assets: ReleaseAsset[]
}

export type LatestReleaseResult =
  | {
      ok: true
      release: ReleaseInfo
      prerelease: ReleaseInfo | null
      fetchedAt: string
      fromCache: boolean
    }
  | {
      ok: false
      reason: 'offline' | 'rate-limited' | 'http-error' | 'invalid-response'
      message: string
      fetchedAt: string
      cached: {
        release: ReleaseInfo
        prerelease: ReleaseInfo | null
        fetchedAt: string
      } | null
    }
