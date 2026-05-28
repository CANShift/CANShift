// schemas/signal-type.ts — Semantic type of a CAN signal.
//
// The signal type drives the colour palette every widget bound to that signal
// uses for its zone fills, value tinting and danger flash. Decoupled from the
// per-widget `iconName` field (now only meaningful on button widgets) so a
// gauge / numeric / vertical-bar widget gets its palette from "what the
// signal measures" instead of from the per-widget icon picker.
//
// Each entry maps 1:1 onto an entry in {@link SENSOR_PALETTE}. Keep this enum
// + the palette table in lockstep — the runtime validator below catches a
// silent mismatch at module load.

import { z } from 'zod'

/**
 * Frozen catalog of known signal types. Add a new entry here AND in
 * {@link SENSOR_PALETTE} together — the test suite asserts the two stay in
 * sync.
 *
 * `generic` is the default for signals that don't fit any of the well-known
 * categories; widgets bound to a `generic` signal fall back to their
 * `style.primaryColor` (the legacy hand-picked colour).
 */
export const SIGNAL_TYPES = [
  'rpm',
  'speed',
  'throttle',
  'coolant',
  'oil_temp',
  'oil_pressure',
  'boost',
  'turbo',
  'battery',
  'fuel',
  'afr',
  'iat',
  'exhaust',
  'generic',
] as const

export const SignalTypeSchema = z.enum(SIGNAL_TYPES)

export type SignalType = z.infer<typeof SignalTypeSchema>

/**
 * Fallback signal type for configs predating the `type` field on
 * {@link SignalDefSchema}. Widgets resolve to {@link DEFAULT_SIGNAL_TYPE}'s
 * palette entry, which intentionally has no opinion and lets the per-widget
 * `style.primaryColor` win.
 */
export const DEFAULT_SIGNAL_TYPE: SignalType = 'generic'
