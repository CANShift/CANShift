import { z } from 'zod'

export const TIMER_LAP_BUFFER_CAPACITY = 32

export const TIMER_COMMAND_CODES = {
  start: 1,
  pause: 2,
  resume: 3,
  reset: 4,
  lap: 5,
} as const

export type TimerCommand = keyof typeof TIMER_COMMAND_CODES
export type TimerCommandCode = (typeof TIMER_COMMAND_CODES)[TimerCommand]

export const encodeTimerCommand = (command: TimerCommand): string =>
  JSON.stringify({ op: TIMER_COMMAND_CODES[command] })

export const TIMER_RUN_STATES = ['reset', 'running', 'paused'] as const
export type TimerRunState = (typeof TIMER_RUN_STATES)[number]

const NonNegativeIntSchema = z.number().int().nonnegative()

export const TimerStateWireSchema = z
  .object({
    st: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    el: NonNegativeIntSchema,
    lc: NonNegativeIntSchema,
    sid: NonNegativeIntSchema,
    ver: NonNegativeIntSchema,
  })
  .passthrough()

export type TimerStateWire = z.infer<typeof TimerStateWireSchema>

export interface TimerBleState {
  state: TimerRunState
  elapsedMs: number
  lapCount: number
  sessionId: number
  version: number
}

export const timerStateFromWire = (wire: TimerStateWire): TimerBleState => ({
  state: TIMER_RUN_STATES[wire.st],
  elapsedMs: wire.el,
  lapCount: wire.lc,
  sessionId: wire.sid,
  version: wire.ver,
})

export const TimerLapWireSchema = z
  .object({
    sid: NonNegativeIntSchema,
    idx: z.number().int().positive(),
    lap_ms: NonNegativeIntSchema,
    total_ms: NonNegativeIntSchema,
  })
  .passthrough()

export type TimerLapWire = z.infer<typeof TimerLapWireSchema>

export interface TimerBleLap {
  sessionId: number
  index: number
  lapMs: number
  totalMs: number
}

export const timerLapFromWire = (wire: TimerLapWire): TimerBleLap => ({
  sessionId: wire.sid,
  index: wire.idx,
  lapMs: wire.lap_ms,
  totalMs: wire.total_ms,
})

type ParseFailure =
  | { kind: 'invalid_json'; raw: string }
  | { kind: 'not_an_object'; payload: unknown }
  | { kind: 'wrong_shape'; issues: z.ZodIssue[] }

export type TimerStateResult = { kind: 'ok'; state: TimerBleState } | ParseFailure

export type TimerLapResult = { kind: 'ok'; lap: TimerBleLap } | ParseFailure

const parseJsonObject = (raw: string): { kind: 'ok'; value: object } | ParseFailure => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid_json', raw }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'not_an_object', payload: parsed }
  }
  return { kind: 'ok', value: parsed }
}

export const parseTimerState = (raw: string): TimerStateResult => {
  const json = parseJsonObject(raw)
  if (json.kind !== 'ok') return json
  const result = TimerStateWireSchema.safeParse(json.value)
  if (!result.success) {
    return { kind: 'wrong_shape', issues: result.error.issues }
  }
  return { kind: 'ok', state: timerStateFromWire(result.data) }
}

export const parseTimerLap = (raw: string): TimerLapResult => {
  const json = parseJsonObject(raw)
  if (json.kind !== 'ok') return json
  const result = TimerLapWireSchema.safeParse(json.value)
  if (!result.success) {
    return { kind: 'wrong_shape', issues: result.error.issues }
  }
  return { kind: 'ok', lap: timerLapFromWire(result.data) }
}
