import { z } from 'zod'

export const SettingsWireSchema = z
  .object({
    brightness: z.number(),
    sleep: z.number(),
  })
  .strict()

export type Settings = z.infer<typeof SettingsWireSchema>

export type SettingsResult =
  | { kind: 'ok'; settings: Settings }
  | { kind: 'invalid_json'; raw: string }
  | { kind: 'not_an_object'; payload: unknown }
  | { kind: 'wrong_shape'; issues: z.ZodIssue[] }

export const parseSettings = (raw: string): SettingsResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid_json', raw }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'not_an_object', payload: parsed }
  }
  const result = SettingsWireSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'wrong_shape', issues: result.error.issues }
  }
  return { kind: 'ok', settings: result.data }
}
