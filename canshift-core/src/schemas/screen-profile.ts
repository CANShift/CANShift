import { z } from 'zod'

export const ScreenProfileIdSchema = z.enum(['crowpanel-28'])

export type ScreenProfileId = z.infer<typeof ScreenProfileIdSchema>

export const ScreenProfileSchema = z
  .object({
    id: ScreenProfileIdSchema,
    name: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()

export type ScreenProfile = z.infer<typeof ScreenProfileSchema>

export const DEFAULT_SCREEN_PROFILE_ID: ScreenProfileId = 'crowpanel-28'

export const SCREEN_PROFILES: readonly ScreenProfile[] = [
  { id: 'crowpanel-28', name: 'CrowPanel 2.8"', width: 320, height: 240 },
] as const

export const getScreenProfile = (id: ScreenProfileId): ScreenProfile => {
  const needle: string = id
  for (const profile of SCREEN_PROFILES) {
    if ((profile.id as string) === needle) return profile
  }
  throw new Error(`screen profile "${needle}" is not registered in SCREEN_PROFILES`)
}

export const resolveScreenProfile = (id: ScreenProfileId | undefined): ScreenProfile =>
  getScreenProfile(id ?? DEFAULT_SCREEN_PROFILE_ID)
