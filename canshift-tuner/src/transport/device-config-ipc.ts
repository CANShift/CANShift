import type { DeviceConfig } from '@tmbk/canshift-core'
import {
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  deviceConfigFromWire,
  deviceConfigToWire,
} from '@tmbk/canshift-core'

import { CMD_GET_DEVICE_CONFIG, CMD_PUT_DEVICE_CONFIG } from './opcodes'
import { getSerialClient } from './webserial-client'

export const deviceConfigIpc = {
  read: async (): Promise<{ success: boolean; config: DeviceConfig | null; error?: string }> => {
    const result = await getSerialClient().send(CMD_GET_DEVICE_CONFIG)
    if (!result.ok) {
      if (result.error === 'config_not_found') return { success: true, config: null }
      return { success: false, config: null, error: result.error ?? 'unknown_error' }
    }
    const raw = result.data?.device_config
    if (!raw || typeof raw !== 'object') return { success: true, config: null }
    const parsed = DeviceConfigWireSchema.safeParse(raw)
    if (!parsed.success) {
      return { success: false, config: null, error: 'invalid_device_config' }
    }
    return { success: true, config: deviceConfigFromWire(parsed.data) }
  },

  write: async (config: DeviceConfig): Promise<{ success: boolean; error?: string }> => {
    const parsed = DeviceConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: 'invalid_device_config' }
    }
    const wire = deviceConfigToWire(parsed.data)
    const result = await getSerialClient().send(CMD_PUT_DEVICE_CONFIG, { device_config: wire })
    if (result.ok) return { success: true }
    return { success: false, error: result.error ?? 'unknown_error' }
  },
}
