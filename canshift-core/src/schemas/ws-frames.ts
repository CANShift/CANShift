import { z } from 'zod'

const FiniteNumberSchema = z.number().refine(Number.isFinite, {
  message: 'must be a finite number',
})

const LOG_TAG_MAX_LEN = 64
const LOG_MESSAGE_MAX_LEN = 4_096
const LOG_LEVELS = ['E', 'W', 'I', 'D', 'V'] as const

export const LogFrameSchema = z
  .object({
    log: FiniteNumberSchema,
    lvl: z.enum(LOG_LEVELS),
    tag: z.string().max(LOG_TAG_MAX_LEN),
    msg: z.string().max(LOG_MESSAGE_MAX_LEN),
  })
  .passthrough()

export type LogFrame = z.infer<typeof LogFrameSchema>

export const CanFrameSchema = z
  .object({
    can: FiniteNumberSchema,
    id: z.number().int().nonnegative(),
    len: z.number().int().min(0).max(8),
    d: z.array(z.number().int().min(0).max(255)).max(8),
  })
  .passthrough()

export type CanFrame = z.infer<typeof CanFrameSchema>

export const TeleFrameSchema = z
  .object({
    tele: FiniteNumberSchema,
    v: z.record(z.string(), FiniteNumberSchema),
  })
  .passthrough()

export type TeleFrame = z.infer<typeof TeleFrameSchema>

export const HeapStatsFrameWireSchema = z
  .object({
    heap_stats: FiniteNumberSchema,
    ts: z.number().int().nonnegative(),
    free_int: z.number().int().nonnegative(),
    largest_int: z.number().int().nonnegative(),
    free_psram: z.number().int().nonnegative().nullable(),
    largest_psram: z.number().int().nonnegative().nullable(),
  })
  .passthrough()

export type HeapStatsFrameWire = z.infer<typeof HeapStatsFrameWireSchema>

export interface HeapStatsFrame {
  tsMs: number
  freeInternal: number
  largestInternal: number
  freePsram: number | null
  largestPsram: number | null
}

export const heapStatsFromWire = (wire: HeapStatsFrameWire): HeapStatsFrame => ({
  tsMs: wire.ts,
  freeInternal: wire.free_int,
  largestInternal: wire.largest_int,
  freePsram: wire.free_psram,
  largestPsram: wire.largest_psram,
})
