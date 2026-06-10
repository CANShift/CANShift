import { z } from 'zod'

import { ButtonActionSchema } from './dashboard.js'
import { Esp32InputGpioSchema } from './device.js'
import { STRING_CAPS } from '../constants/firmware-caps.js'
import { mapObjectKeys } from '../wire/keymap.js'

const BINDING_WIRE_TO_DOMAIN = { debounce_ms: 'debounceMs' } as const
const BINDING_DOMAIN_TO_WIRE = { debounceMs: 'debounce_ms' } as const

export const MAX_INPUT_BINDINGS = 16

const DEBOUNCE_MIN_MS = 1
const DEBOUNCE_MAX_MS = 500

export const INPUT_BINDING_ID_MAX_LEN = 32

const InputBindingIdSchema = z
  .string()
  .min(1, 'id is required')
  .max(
    INPUT_BINDING_ID_MAX_LEN,
    `id must be at most ${String(INPUT_BINDING_ID_MAX_LEN)} characters`
  )

export const InputActiveLevelSchema = z.enum(['low', 'high'])
export type InputActiveLevel = z.infer<typeof InputActiveLevelSchema>

export const InputPressKindSchema = z.enum(['short', 'long', 'double'])
export type InputPressKind = z.infer<typeof InputPressKindSchema>

const DebounceMsSchema = z
  .number()
  .int()
  .min(DEBOUNCE_MIN_MS, `debounce must be at least ${String(DEBOUNCE_MIN_MS)}ms`)
  .max(DEBOUNCE_MAX_MS, `debounce must be at most ${String(DEBOUNCE_MAX_MS)}ms`)

export const InputBindingWireSchema = z
  .object({
    id: InputBindingIdSchema,
    pin: Esp32InputGpioSchema,
    active: InputActiveLevelSchema,
    pullup: z.boolean(),
    debounce_ms: DebounceMsSchema,
    kind: InputPressKindSchema,
    action: ButtonActionSchema,
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

const inputBindingFromWire = (wire: InputBindingWire): InputBinding =>
  mapObjectKeys(wire, BINDING_WIRE_TO_DOMAIN) as InputBinding

const inputBindingToWire = (binding: InputBinding): InputBindingWire =>
  mapObjectKeys(binding, BINDING_DOMAIN_TO_WIRE) as InputBindingWire

export const inputBindingsFromWire = (wire: InputBindingsConfigWire): InputBindingsConfig => ({
  inputBindings: wire.input_bindings.map(inputBindingFromWire),
})

export const inputBindingsToWire = (cfg: InputBindingsConfig): InputBindingsConfigWire => ({
  input_bindings: cfg.inputBindings.map(inputBindingToWire),
})
