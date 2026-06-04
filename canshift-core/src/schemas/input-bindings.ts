// schemas/input-bindings.ts — Zod schemas for physical GPIO button bindings.
//
// Two strict schemas live here:
//   - `InputBindingsConfigSchema` (camelCase) — domain shape used by studio
//     renderer/main and any future JS consumer.
//   - `InputBindingsConfigWireSchema` (snake_case) — on-disk JSON wire format
//     read verbatim by canshift-firmware (`config_loader.cpp`). Used only at
//     IO/IPC boundaries.
//
// `inputBindingsFromWire` / `inputBindingsToWire` are the single source of
// truth for the snake↔camel conversion at the top level. The embedded
// `action` payload mirrors the existing dashboard.json convention (camelCase
// keys, snake-case type literals) so the same C++ `parseButtonAction` accepts
// it without divergence. Issue #833.
//
// Each binding maps one physical button press to ONE dashboard action,
// reusing `ButtonActionSchema` so input bindings stay in lockstep with the
// on-screen button action variants.

import { z } from 'zod'

import { ButtonActionSchema } from './dashboard.js'
import { Esp32InputGpioSchema } from './device.js'
import { STRING_CAPS } from '../constants/firmware-caps.js'
import { mapObjectKeys } from '../wire/keymap.js'

// snake↔camel rename map shared by both per-binding mappers below. Only
// `debounce_ms`/`debounceMs` actually differs — every other field is
// already a camel-friendly identifier on both sides. Audit follow-up to
// #1207.
const BINDING_WIRE_TO_DOMAIN = { debounce_ms: 'debounceMs' } as const
const BINDING_DOMAIN_TO_WIRE = { debounceMs: 'debounce_ms' } as const

// ---------------------------------------------------------------------------
// Static caps — kept tight so the firmware can keep a fixed C array per
// binding without dynamic allocation in the input task.
// ---------------------------------------------------------------------------

/** Cap on simultaneous physical button bindings the firmware will register. */
export const MAX_INPUT_BINDINGS = 16

/** Range of supported debounce values, in milliseconds. */
const DEBOUNCE_MIN_MS = 1
const DEBOUNCE_MAX_MS = 500

/** Maximum length of an input-binding `id` field — keeps firmware buffers small. */
export const INPUT_BINDING_ID_MAX_LEN = 32

const InputBindingIdSchema = z
  .string()
  .min(1, 'id is required')
  .max(
    INPUT_BINDING_ID_MAX_LEN,
    `id must be at most ${String(INPUT_BINDING_ID_MAX_LEN)} characters`
  )

/** Active level — `low` is the default (button to GND + internal pullup). */
export const InputActiveLevelSchema = z.enum(['low', 'high'])
export type InputActiveLevel = z.infer<typeof InputActiveLevelSchema>

/** Press kind — short tap, long press, or double tap. */
export const InputPressKindSchema = z.enum(['short', 'long', 'double'])
export type InputPressKind = z.infer<typeof InputPressKindSchema>

const DebounceMsSchema = z
  .number()
  .int()
  .min(DEBOUNCE_MIN_MS, `debounce must be at least ${String(DEBOUNCE_MIN_MS)}ms`)
  .max(DEBOUNCE_MAX_MS, `debounce must be at most ${String(DEBOUNCE_MAX_MS)}ms`)

// ---------------------------------------------------------------------------
// Wire schema — snake_case, matches the C++ ArduinoJson keys verbatim.
// ---------------------------------------------------------------------------

export const InputBindingWireSchema = z
  .object({
    id: InputBindingIdSchema,
    pin: Esp32InputGpioSchema,
    active: InputActiveLevelSchema,
    pullup: z.boolean(),
    debounce_ms: DebounceMsSchema,
    kind: InputPressKindSchema,
    action: ButtonActionSchema,
    // Optional signal name shared with an on-screen button widget. When set,
    // pressing this physical button flips the toggle visual state of every
    // dashboard button widget bound to the same signal — so a physical ALS
    // arm button keeps the on-screen ALS button in sync without waiting for
    // the ECU echo. Either side can also disarm (issue #833).
    signal: z.string().max(STRING_CAPS.BINDING_SIGNAL).optional(),
  })
  .strict()

export type InputBindingWire = z.infer<typeof InputBindingWireSchema>

export const InputBindingsConfigWireSchema = z
  .object({
    input_bindings: z
      .array(InputBindingWireSchema)
      .max(
        MAX_INPUT_BINDINGS,
        `input_bindings cannot exceed ${String(MAX_INPUT_BINDINGS)} entries (firmware cap)`
      ),
  })
  .strict()

export type InputBindingsConfigWire = z.infer<typeof InputBindingsConfigWireSchema>

// ---------------------------------------------------------------------------
// Domain schema — camelCase. The embedded action payload is the SAME shape
// in both wire and domain because dashboard.json already uses camelCase keys
// with snake-case type literals — no mapping needed inside `action`.
// ---------------------------------------------------------------------------

export const InputBindingSchema = z
  .object({
    id: InputBindingIdSchema,
    pin: Esp32InputGpioSchema,
    active: InputActiveLevelSchema,
    pullup: z.boolean(),
    debounceMs: DebounceMsSchema,
    kind: InputPressKindSchema,
    action: ButtonActionSchema,
    signal: z.string().max(STRING_CAPS.BINDING_SIGNAL).optional(),
  })
  .strict()

export type InputBinding = z.infer<typeof InputBindingSchema>

export const InputBindingsConfigSchema = z
  .object({
    inputBindings: z
      .array(InputBindingSchema)
      .max(
        MAX_INPUT_BINDINGS,
        `inputBindings cannot exceed ${String(MAX_INPUT_BINDINGS)} entries (firmware cap)`
      ),
  })
  .strict()

export type InputBindingsConfig = z.infer<typeof InputBindingsConfigSchema>

// ---------------------------------------------------------------------------
// Boundary mappers — pure; assume input already passed the matching schema.
// ---------------------------------------------------------------------------

function inputBindingFromWire(wire: InputBindingWire): InputBinding {
  return mapObjectKeys(wire, BINDING_WIRE_TO_DOMAIN) as InputBinding
}

function inputBindingToWire(binding: InputBinding): InputBindingWire {
  return mapObjectKeys(binding, BINDING_DOMAIN_TO_WIRE) as InputBindingWire
}

/** Wire → domain at the file/IPC boundary. */
export function inputBindingsFromWire(wire: InputBindingsConfigWire): InputBindingsConfig {
  return { inputBindings: wire.input_bindings.map(inputBindingFromWire) }
}

/** Domain → wire at the file/IPC boundary. */
export function inputBindingsToWire(cfg: InputBindingsConfig): InputBindingsConfigWire {
  return { input_bindings: cfg.inputBindings.map(inputBindingToWire) }
}
