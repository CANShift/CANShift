// schemas/screen-settings.ts — Zod schema for the CMD_SCREEN_SETTINGS IPC
// payload (studio main ↔ firmware) and the BLE SETTINGS characteristic
// (mobile ↔ firmware). Issue #1015 (S-H-1).
//
// The previous studio-side guard accepted any finite number for brightness
// and sleep — a malicious or buggy renderer could push brightness=-9999 or
// sleep=86400 (24 h) and the studio handler would forward it unchecked.
// This schema is the single source of truth for the bounds; studio's IPC
// handler parses with `.safeParse` and rejects out-of-range payloads.
//
// Wire field names match the firmware JSON keys verbatim
// (`canshift-firmware/README.md` § SETTINGS payload):
//
//     {"brightness":80,"sleep":30,"rotation":0|180}
//
// so this is both the wire and the domain shape — no snake↔camel mapping
// is required.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * Brightness in percent. Firmware clamps to 10–100 internally
 * (`settings_page.cpp:88`); the schema accepts the full 0–100 range so the
 * studio UI can model "off" cleanly and let firmware apply its own floor.
 * Anything outside this is either a renderer bug or a hostile payload.
 *
 * TODO(#1299) — contract drift: firmware does NOT honour 0 today; values
 * <10 are silently replaced with DEFAULT_BRIGHTNESS (50%). Either firmware
 * implements true backlight off OR this schema gains `.min(10)`. Pending
 * product decision tracked in #1299 (follow-up to #1289).
 */
const BRIGHTNESS_MIN_PCT = 0
const BRIGHTNESS_MAX_PCT = 100

/**
 * Sleep timeout in seconds. 0 = never sleep. Hard cap of 1 hour mirrors
 * the audit recommendation (S-H-1) and keeps the firmware countdown inside
 * a 32-bit ms timer with comfortable headroom.
 */
const SLEEP_MIN_S = 0
const SLEEP_MAX_S = 3600

/**
 * The firmware only supports two mounting orientations; applying a third
 * value is undefined behaviour on the LVGL display driver side.
 */
const ALLOWED_ROTATIONS = [0, 180] as const

const BrightnessSchema = z
  .number()
  .int('brightness must be a whole percent')
  .min(BRIGHTNESS_MIN_PCT, `brightness cannot be below ${String(BRIGHTNESS_MIN_PCT)}%`)
  .max(BRIGHTNESS_MAX_PCT, `brightness cannot exceed ${String(BRIGHTNESS_MAX_PCT)}%`)

const SleepSchema = z
  .number()
  .int('sleep timeout must be a whole number of seconds')
  .min(SLEEP_MIN_S, `sleep cannot be below ${String(SLEEP_MIN_S)} s`)
  .max(SLEEP_MAX_S, `sleep cannot exceed ${String(SLEEP_MAX_S)} s (1 h)`)

const RotationSchema = z.union([z.literal(0), z.literal(180)])

/**
 * CMD_SCREEN_SETTINGS payload. Strict — extra fields are rejected so a
 * stale studio build can't smuggle unknown keys past an older firmware.
 */
export const ScreenSettingsSchema = z
  .object({
    brightness: BrightnessSchema,
    sleep: SleepSchema,
    rotation: RotationSchema.optional(),
  })
  .strict()

export type ScreenSettings = z.infer<typeof ScreenSettingsSchema>

/** Exported bounds — handy for studio UI sliders so they stay in sync. */
export const SCREEN_SETTINGS_BOUNDS = {
  brightnessMinPct: BRIGHTNESS_MIN_PCT,
  brightnessMaxPct: BRIGHTNESS_MAX_PCT,
  sleepMinSeconds: SLEEP_MIN_S,
  sleepMaxSeconds: SLEEP_MAX_S,
  allowedRotations: ALLOWED_ROTATIONS,
} as const
