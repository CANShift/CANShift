import { z } from 'zod'

import { HexColorSchema, SemVerSchema } from './common.js'
import { Obd2PollingSchema } from './obd2.js'
import { SignalTypeSchema } from './signal-type.js'
import {
  CAN_29BIT_MAX,
  CAN_FRAME_MAX_BYTES,
  FIRMWARE_CAPS,
  MAX_RAMP_STOPS,
  STRING_CAPS,
} from '../constants/firmware-caps.js'

const CAN_FRAME_ID_REGEX = /^0[xX][0-9a-fA-F]{1,8}$/

const BIT_MASK_REGEX = /^0[xX][0-9a-fA-F]+$/

const OUTBOUND_FRAME_ID_REGEX = /^0[xX][0-9a-fA-F]{1,8}$/

const SAFE_EXPR_REGEX = /^[\w\s+\-*/%<>=!&|^().]+$/

const MAX_EXPR_LENGTH = 128

export const ColorRampStopSchema = z
  .object({
    id: z.string().min(1).optional(),
    value: z.number(),
    color: HexColorSchema,
  })
  .strict()

export const RampInterpolationSchema = z.enum(['linear', 'step'])

export const ColorRampSchema = z
  .object({
    stops: z
      .array(ColorRampStopSchema)
      .min(2, 'colorRamp.stops must contain at least 2 stops')
      .max(
        MAX_RAMP_STOPS,
        `colorRamp.stops cannot exceed ${MAX_RAMP_STOPS.toString()} entries (firmware cap)`
      )
      .refine(
        (stops) =>
          stops.every((stop, idx) => {
            if (idx === 0) return true
            const prev = stops[idx - 1]
            return prev !== undefined && prev.value < stop.value
          }),
        { message: 'colorRamp.stops must be sorted strictly ascending by value' }
      ),
    interpolate: RampInterpolationSchema,
  })
  .strict()

export const SignalDefSchema = z
  .object({
    _comment: z.string().optional(),
    _batteryThresholds: z.string().optional(),
    name: z.string().max(STRING_CAPS.SIGNAL_NAME),
    canFrameId: z
      .string()
      .regex(CAN_FRAME_ID_REGEX, 'canFrameId must be hex like 0x123 or 0x1E005000 (1-8 hex chars)'),
    startByte: z
      .number()
      .int()
      .min(0)
      .max(CAN_FRAME_MAX_BYTES - 1),
    byteLength: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(8)]),
    bigEndian: z.boolean(),
    signed: z.boolean(),
    bitMask: z.string().regex(BIT_MASK_REGEX, 'bitMask must be a hex literal like 0xFF').optional(),
    scale: z.number().finite(),
    offset: z.number().finite(),
    expr: z
      .string()
      .max(MAX_EXPR_LENGTH, `expr cannot exceed ${String(MAX_EXPR_LENGTH)} chars`)
      .regex(SAFE_EXPR_REGEX, 'expr contains disallowed characters')
      .optional(),
    unit: z.string().max(STRING_CAPS.SIGNAL_UNIT),
    min: z.number(),
    max: z.number(),
    warningLevel: z.number().optional(),
    dangerLevel: z.number().optional(),
    highWarningLevel: z.number().optional(),
    highDangerLevel: z.number().optional(),
    timeoutMs: z.number(),
    type: SignalTypeSchema.optional(),
    colorRamp: ColorRampSchema.optional(),
    polling: Obd2PollingSchema.optional(),
  })
  .strict()
  .refine((s) => s.min < s.max, {
    message: 'min must be less than max',
    path: ['min'],
  })
  .superRefine((s, ctx) => {
    const levelKeys: ('warningLevel' | 'dangerLevel' | 'highWarningLevel' | 'highDangerLevel')[] = [
      'warningLevel',
      'dangerLevel',
      'highWarningLevel',
      'highDangerLevel',
    ]
    for (const key of levelKeys) {
      const v = s[key]
      if (v === undefined) continue
      if (v < s.min || v > s.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} (${v.toString()}) must be within [min=${s.min.toString()}, max=${s.max.toString()}]`,
          path: [key],
        })
      }
    }

    if (
      s.warningLevel !== undefined &&
      s.dangerLevel !== undefined &&
      s.warningLevel === s.dangerLevel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'warningLevel and dangerLevel must differ to form a monotonic ramp: ' +
          'use warningLevel < dangerLevel for high-side, ' +
          'or warningLevel > dangerLevel for low-side',
        path: ['dangerLevel'],
      })
    }

    if (
      s.highWarningLevel !== undefined &&
      s.highDangerLevel !== undefined &&
      s.highWarningLevel > s.highDangerLevel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'highWarningLevel must be <= highDangerLevel (high-side ramp)',
        path: ['highDangerLevel'],
      })
    }

    if (
      s.warningLevel !== undefined &&
      s.dangerLevel !== undefined &&
      s.highWarningLevel !== undefined &&
      s.highDangerLevel !== undefined &&
      s.dangerLevel <= s.warningLevel &&
      s.warningLevel >= s.highWarningLevel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'low-side warningLevel must be below highWarningLevel',
        path: ['highWarningLevel'],
      })
    }
  })

export const CanSpeedKbpsSchema = z.union([
  z.literal(125),
  z.literal(250),
  z.literal(500),
  z.literal(1000),
])

export type CanSpeedKbps = z.infer<typeof CanSpeedKbpsSchema>

export const CAN_SPEED_OPTIONS: readonly CanSpeedKbps[] = CanSpeedKbpsSchema.options.map(
  (o) => o.value
)

export const OutboundCanSignalSchema = z
  .object({
    id: z
      .string()
      .regex(OUTBOUND_FRAME_ID_REGEX, 'id must be a hex literal like 0x600 (up to 8 hex chars)')
      .refine(
        (s) => Number.parseInt(s, 16) <= CAN_29BIT_MAX,
        `id must fit in 29 bits (≤ 0x${CAN_29BIT_MAX.toString(16).toUpperCase()})`
      ),
    extended: z.boolean().optional(),
    encoding: z.string().optional(),
  })
  .strict()

export const SignalConfigSchema = z
  .object({
    _comment: z.string().optional(),
    _warning: z.string().optional(),
    _outboundWarning: z.string().optional(),
    version: SemVerSchema,
    protocol: z.string().max(STRING_CAPS.PROTOCOL),
    canSpeedKbps: CanSpeedKbpsSchema,
    out: z.record(z.string(), OutboundCanSignalSchema).optional(),
    signals: z
      .array(SignalDefSchema)
      .max(
        FIRMWARE_CAPS.MAX_SIGNALS,
        `signals cannot exceed ${String(FIRMWARE_CAPS.MAX_SIGNALS)} entries (firmware cap)`
      ),
  })
  .strict()

export type ColorRampStop = z.infer<typeof ColorRampStopSchema>
export type RampInterpolation = z.infer<typeof RampInterpolationSchema>
export type ColorRamp = z.infer<typeof ColorRampSchema>
export type SignalDef = z.infer<typeof SignalDefSchema>
export type OutboundCanSignal = z.infer<typeof OutboundCanSignalSchema>
export type SignalConfig = z.infer<typeof SignalConfigSchema>
