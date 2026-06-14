import type { InputBindingsConfig } from '@tmbk/canshift-core'
import {
  InputBindingsConfigSchema,
  InputBindingsConfigWireSchema,
  inputBindingsFromWire,
  inputBindingsToWire,
} from '@tmbk/canshift-core'

import { CMD_GET_INPUT_BINDINGS, CMD_PUT_INPUT_BINDINGS } from './opcodes'
import { getSerialClient } from './webserial-client'

export const inputBindingsIpc = {
  read: async (): Promise<{
    success: boolean
    config: InputBindingsConfig | null
    error?: string
  }> => {
    const result = await getSerialClient().send(CMD_GET_INPUT_BINDINGS)
    if (!result.ok) {
      if (result.error === 'config_not_found') {
        return { success: true, config: { inputBindings: [] } }
      }
      return { success: false, config: null, error: result.error ?? 'unknown_error' }
    }
    const raw = result.data?.input_bindings
    if (raw === undefined) {
      return { success: true, config: { inputBindings: [] } }
    }
    const wireDoc = Array.isArray(raw) ? { input_bindings: raw } : raw
    const parsed = InputBindingsConfigWireSchema.safeParse(wireDoc)
    if (!parsed.success) {
      return { success: false, config: null, error: 'invalid_input_bindings' }
    }
    return { success: true, config: inputBindingsFromWire(parsed.data) }
  },

  write: async (config: InputBindingsConfig): Promise<{ success: boolean; error?: string }> => {
    const parsed = InputBindingsConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: 'invalid_input_bindings' }
    }
    const wire = inputBindingsToWire(parsed.data)
    const result = await getSerialClient().send(CMD_PUT_INPUT_BINDINGS, wire)
    if (result.ok) return { success: true }
    return { success: false, error: result.error ?? 'unknown_error' }
  },
}
