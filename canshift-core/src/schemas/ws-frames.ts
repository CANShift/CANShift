// schemas/ws-frames.ts — Zod schemas for unsolicited firmware WS frames.
//
// The firmware emits three unsolicited frame discriminators alongside the
// command-ack stream over `/ws` on port 81 (mirroring the USB 5050 wire):
//
//   - `tele`  — proactive telemetry, ~5 Hz: `{tele:1, v:{signalName:number}}`
//   - `can`   — raw CAN frames from the scanner: `{can:1, id, len, d[]}`
//   - `log`   — structured device log lines: `{log:1, lvl, tag, msg}`
//
// `transport/index.ts` previously hand-narrowed each `unknown` field with
// `typeof` checks (WS-5, issue #1288). Schemas here let the transport layer
// `.safeParse()` every inbound frame and drop malformed ones, so a firmware
// drift surfaces as a single warning log instead of silently corrupting
// downstream stores.

import { z } from 'zod'

const FiniteNumberSchema = z.number().refine(Number.isFinite, {
  message: 'must be a finite number',
})

// Log frames carry a 16-char tag and a free-form message — cap both so a
// runaway firmware can't flood the log store with multi-MB payloads.
const LOG_TAG_MAX_LEN = 64
const LOG_MESSAGE_MAX_LEN = 4_096
const LOG_LEVELS = ['E', 'W', 'I', 'D', 'V'] as const

/**
 * Inbound device log line. Shape mirrors `canshift-firmware/src/diag/logger.h`:
 *   `{"log":1, "lvl":"E|W|I|D|V", "tag":"<≤16 chars>", "msg":"<text>"}`
 * `.passthrough()` so an additive firmware field (sequence number, …) doesn't
 * trip parsing — defense in depth, not strict validation.
 */
export const LogFrameSchema = z
  .object({
    log: FiniteNumberSchema,
    lvl: z.enum(LOG_LEVELS),
    tag: z.string().max(LOG_TAG_MAX_LEN),
    msg: z.string().max(LOG_MESSAGE_MAX_LEN),
  })
  .passthrough()

export type LogFrame = z.infer<typeof LogFrameSchema>

/**
 * Inbound CAN frame from the scanner. Shape from
 * `canshift-firmware/src/hal/usb/usb_comm.cpp`:
 *   `{"can":1, "id":291, "len":8, "d":[0,1,2,3,4,5,6,7]}`
 * `id` is a CAN identifier (≤ 0x1FFFFFFF for extended frames), `len` ≤ 8,
 * `d` is a byte array of length `len`.
 */
export const CanFrameSchema = z
  .object({
    can: FiniteNumberSchema,
    id: z.number().int().nonnegative(),
    len: z.number().int().min(0).max(8),
    d: z.array(z.number().int().min(0).max(255)).max(8),
  })
  .passthrough()

export type CanFrame = z.infer<typeof CanFrameSchema>

/**
 * Inbound telemetry frame. Shape:
 *   `{"tele":1, "v":{"<signalName>":<finite number>, …}}`
 * The signal map is open-ended (one key per active signal) — values must be
 * finite numbers. Non-numeric entries are filtered at the dispatch layer.
 */
export const TeleFrameSchema = z
  .object({
    tele: FiniteNumberSchema,
    v: z.record(z.string(), FiniteNumberSchema),
  })
  .passthrough()

export type TeleFrame = z.infer<typeof TeleFrameSchema>

/**
 * Inbound heap-stats frame from the firmware (issue #1369).
 *   `{"heap_stats":1, "ts":<ms>, "free_int":<bytes>, "largest_int":<bytes>,
 *     "free_psram":<bytes|null>, "largest_psram":<bytes|null>}`
 * `ts` is `millis()` since firmware boot; the tuner converts to wall-clock
 * via the connection start time. PSRAM fields are `null` on WROOM (no
 * PSRAM); WROVER builds report both. Sample cadence is 30 s — see
 * `EMIT_INTERVAL_MS` in `canshift-firmware/src/diag/heap_stats.cpp`.
 */
export const HeapStatsFrameSchema = z
  .object({
    heap_stats: FiniteNumberSchema,
    ts: z.number().int().nonnegative(),
    free_int: z.number().int().nonnegative(),
    largest_int: z.number().int().nonnegative(),
    free_psram: z.number().int().nonnegative().nullable(),
    largest_psram: z.number().int().nonnegative().nullable(),
  })
  .passthrough()

export type HeapStatsFrame = z.infer<typeof HeapStatsFrameSchema>
