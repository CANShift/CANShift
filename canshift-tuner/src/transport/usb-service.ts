import type { DashboardConfig, ScreenSettings } from '@tmbk/canshift-core'
import { validateDashboard } from '@tmbk/canshift-core'

import {
  CMD_CALIBRATE_TOUCH,
  CMD_GET_CONFIG,
  CMD_PING,
  CMD_PUSH_CONFIG,
  CMD_QUERY_VERSION,
  CMD_REBOOT,
  CMD_SCREEN_SETTINGS,
  CMD_SET_DAY_NIGHT,
  CMD_TOGGLE_DAY_NIGHT,
} from './opcodes'
import type { FirmwareIdentityResult, PingResult, RawAck, UsbResult } from './types'
import { toUsbResult } from './types'
import { getSerialClient } from './webserial-client'

const OK: UsbResult = { success: true }

export const usbService = {
  pushConfig: async (config: DashboardConfig): Promise<UsbResult> => {
    const validation = validateDashboard(config)
    if (!validation.valid) {
      return {
        success: false,
        error: `invalid_dashboard_config: ${validation.errors[0] ?? 'unknown_validation_error'}`,
      }
    }
    const result = await getSerialClient().send(
      CMD_PUSH_CONFIG,
      { payload: config },
      { scaleWithPayload: true }
    )
    return toUsbResult(result)
  },

  getConfig: async (): Promise<
    { kind: 'ok'; config: unknown } | { kind: 'error'; error: string }
  > => {
    const result = await getSerialClient().send(CMD_GET_CONFIG, {}, { timeoutMs: 5_000 })
    if (!result.ok) {
      return { kind: 'error', error: result.error ?? 'unknown_error' }
    }
    const config = result.data?.config
    if (config === undefined || config === null) {
      return { kind: 'error', error: 'no_config_in_response' }
    }
    return { kind: 'ok', config }
  },

  pushScreenSettings: async (settings: ScreenSettings): Promise<UsbResult> => {
    const result = await getSerialClient().send(CMD_SCREEN_SETTINGS, { ...settings })
    return toUsbResult(result)
  },

  ping: async (timeoutMs = 1_500): Promise<PingResult> => {
    const result = await getSerialClient().send(CMD_PING, {}, { timeoutMs })
    if (!result.ok) {
      return { kind: 'error', error: result.error ?? 'unknown_error' }
    }
    const uptimeMs = typeof result.data?.uptime_ms === 'number' ? result.data.uptime_ms : null
    return { kind: 'ok', uptimeMs }
  },

  queryVersion: async (): Promise<FirmwareIdentityResult> => {
    const result = await getSerialClient().send(CMD_QUERY_VERSION, {}, { timeoutMs: 2_000 })
    if (!result.ok) {
      return { kind: 'error', error: result.error ?? 'unknown_error' }
    }
    const d = result.data
    if (!d || typeof d.version !== 'string' || typeof d.protocol !== 'number') {
      return { kind: 'error', error: 'invalid_response' }
    }
    return {
      kind: 'ok',
      identity: {
        version: d.version,
        protocol: d.protocol,
        isDay: d.is_day === 1,
      },
    }
  },

  reboot: async (): Promise<UsbResult> => {
    const result = await getSerialClient().send(CMD_REBOOT, {}, { timeoutMs: 1_000 })
    if (result.ok) return OK
    if (result.error === 'ack_timeout' || result.error === 'connection_closed') return OK
    return toUsbResult(result)
  },

  toggleDayNight: async (): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_TOGGLE_DAY_NIGHT))
  },

  setDayNight: async (day: boolean): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_SET_DAY_NIGHT, { day }))
  },

  calibrateTouch: async (): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_CALIBRATE_TOUCH))
  },

  sendRaw: async (
    cmd: number,
    fields: Record<string, unknown> = {},
    timeoutMs = 3_000
  ): Promise<RawAck> => {
    const result = await getSerialClient().send(cmd, fields, { timeoutMs })
    if (result.ok) {
      return { kind: 'ok', data: result.data ?? {} }
    }
    return { kind: 'error', error: result.error ?? 'unknown_error', data: result.data ?? null }
  },
}
