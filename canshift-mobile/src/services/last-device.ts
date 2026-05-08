// last-device.ts — persist the last-connected BLE device id via SecureStore

import * as SecureStore from 'expo-secure-store'
import { log } from '../stores/log.store'

const LAST_DEVICE_ID_KEY = 'canshift.lastBleDeviceId'

export async function rememberDevice(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_DEVICE_ID_KEY, id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to persist last device id: ${msg}`)
  }
}

export async function forgetDevice(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LAST_DEVICE_ID_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to forget last device id: ${msg}`)
  }
}

export async function getLastDevice(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_DEVICE_ID_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to read last device id: ${msg}`)
    return null
  }
}
