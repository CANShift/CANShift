import { z } from 'zod'

export const ReleaseAssetSchema = z.object({
  name: z.string(),
  downloadUrl: z.string(),
  sizeBytes: z.number().finite(),
  contentType: z.string().optional(),
  digest: z.string().nullable().optional(),
})

export type ReleaseAsset = z.infer<typeof ReleaseAssetSchema>

export const ReleaseInfoSchema = z.object({
  version: z.string(),
  tag: z.string(),
  name: z.string().nullable(),
  notes: z.string(),
  publishedAt: z.string(),
  prerelease: z.boolean(),
  htmlUrl: z.string(),
  assets: z.array(ReleaseAssetSchema),
})

export type ReleaseInfo = z.infer<typeof ReleaseInfoSchema>

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
