import { CMD_CAN_SCAN_START, CMD_CAN_SCAN_STOP } from './opcodes'
import { toUsbResult } from './types'
import { getSerialClient } from './webserial-client'

export const canScannerIpc = {
  start: async (): Promise<{ success: boolean; error?: string }> => {
    return toUsbResult(await getSerialClient().send(CMD_CAN_SCAN_START))
  },
  stop: async (): Promise<{ success: boolean; error?: string }> => {
    return toUsbResult(await getSerialClient().send(CMD_CAN_SCAN_STOP))
  },
}
