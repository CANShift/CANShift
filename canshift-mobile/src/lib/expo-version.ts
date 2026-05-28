// canshift-mobile/src/lib/expo-version.ts
// Reads the running app version from expo-constants, handling both the modern
// expoConfig shape and legacy manifest shapes (SDK < 49, dev builds) via Zod.

import Constants from 'expo-constants'
import { z } from 'zod'

const legacySchema = z
  .object({
    nativeAppVersion: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
  })
  .passthrough()

export function readAppVersion(): string | null {
  const fromConfig = Constants.expoConfig?.version
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig

  const legacy = legacySchema.safeParse(Constants)
  if (!legacy.success) return null
  return legacy.data.nativeAppVersion ?? legacy.data.version ?? null
}
