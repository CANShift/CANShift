import { File, Paths } from 'expo-file-system'
import { z } from 'zod'
import { log } from '../stores/log.store'

const SESSIONS_FILE_NAME = 'canshift-timer-sessions.json'

const sessionLapSchema = z.object({
  index: z.number().int().positive(),
  lapMs: z.number().int().nonnegative(),
  totalMs: z.number().int().nonnegative(),
})

const sessionSchema = z.object({
  key: z.string().min(1),
  startedAt: z.number(),
  laps: z.array(sessionLapSchema),
})

const sessionsSchema = z.array(sessionSchema)

export type StoredTimerSession = z.infer<typeof sessionSchema>

export interface TimerSessionStorage {
  load: () => Promise<StoredTimerSession[]>
  save: (sessions: readonly StoredTimerSession[]) => Promise<void>
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const sessionsFile = (): File => new File(Paths.document, SESSIONS_FILE_NAME)

export const fileTimerSessionStorage: TimerSessionStorage = {
  load: async () => {
    try {
      const file = sessionsFile()
      if (!file.exists) return []
      const parsed = sessionsSchema.safeParse(JSON.parse(await file.text()) as unknown)
      if (!parsed.success) {
        log('warn', 'Stored timer sessions malformed — starting empty')
        return []
      }
      return parsed.data
    } catch (err) {
      log('warn', `Failed to read timer sessions — starting empty: ${errText(err)}`)
      return []
    }
  },

  save: (sessions) => {
    try {
      const file = sessionsFile()
      file.write(JSON.stringify(sessions))
    } catch (err) {
      log('warn', `Failed to persist timer sessions: ${errText(err)}`)
    }
    return Promise.resolve()
  },
}
