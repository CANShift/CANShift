import type { DashboardConfig } from '@tmbk/canshift-core'

import { CMD_GET_CONFIG } from './opcodes'
import type { DeviceConfigResult } from './types'
import { getSerialClient } from './webserial-client'

export const deviceIpc = {
  getConfig: async (): Promise<DeviceConfigResult> => {
    const result = await getSerialClient().send(CMD_GET_CONFIG, {}, { timeoutMs: 8_000 })
    if (result.ok) {
      const cfg = result.data?.config
      if (cfg && typeof cfg === 'object') {
        return { kind: 'ok', config: cfg as DashboardConfig }
      }
      return { kind: 'none' }
    }
    if (result.error === 'config_not_found') return { kind: 'none' }
    return { kind: 'error', error: result.error ?? 'unknown_error' }
  },
}
