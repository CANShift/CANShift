// schemas/obd2.ts — OBD-II polling configuration for request/response ECUs.
//
// CANShift's default mode is passive — the firmware listens to CAN frames the
// ECU broadcasts on its own (MaxxECU and friends). OBD-II ECUs do not
// broadcast; the dash must send a request frame (0x7DF, mode 0x01, PID byte)
// and decode the response (0x7E8). When a `SignalDef.polling` block is set,
// the firmware enqueues the request at `intervalMs` and parses the answer
// into that signal. Absent block = legacy broadcast behaviour (no change).
//
// v1 scope (issue #841): Mode 01 only, single ECU at the standard 0x7DF/0x7E8
// pair. Multi-ECU iso-tp and modes 02-09 land in a follow-up.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Polling bounds — exposed so the studio slider and firmware scheduler can
// share a single source of truth.
// ---------------------------------------------------------------------------

/** Minimum polling interval (ms). Below ~50ms a single signal saturates a
 *  500kbps bus once you account for response latency; 100ms is a safe
 *  default that lets several signals coexist without queue starvation. */
export const OBD2_MIN_INTERVAL_MS = 100

/** Maximum polling interval (ms). 60s is "almost never" — anything slower
 *  should be a one-shot diagnostic instead of a polled signal. */
export const OBD2_MAX_INTERVAL_MS = 60000

/** Default interval if the studio editor hasn't picked one yet. */
export const OBD2_DEFAULT_INTERVAL_MS = 1000

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** OBD-II mode byte. v1 ships Mode 01 (current data) only. Future modes
 *  (02 freeze frame, 09 vehicle info, ...) land as a union extension. */
export const Obd2ModeSchema = z.literal(0x01)

/** OBD-II PID byte — 0x00..0xFF. Mode 01 uses the J1979 PID catalog
 *  (see OBD2_MODE01_PIDS); other modes share the same byte range. */
export const Obd2PidSchema = z.number().int().min(0).max(0xff)

/** Polling-mode signal request descriptor. Attached to a SignalDef when the
 *  signal must be actively queried (request/response) rather than passively
 *  decoded from a broadcast frame. */
export const Obd2PollingSchema = z
  .object({
    mode: Obd2ModeSchema,
    pid: Obd2PidSchema,
    intervalMs: z.number().int().min(OBD2_MIN_INTERVAL_MS).max(OBD2_MAX_INTERVAL_MS),
  })
  .strict()

export type Obd2Mode = z.infer<typeof Obd2ModeSchema>
export type Obd2Pid = z.infer<typeof Obd2PidSchema>
export type Obd2Polling = z.infer<typeof Obd2PollingSchema>
