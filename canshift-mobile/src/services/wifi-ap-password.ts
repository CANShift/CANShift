import * as SecureStore from 'expo-secure-store'
import { log } from '../stores/log.store'

const WIFI_AP_PASSWORD_KEY = 'canshift.wifiApPassword'

export const setWifiApPassword = async (password: string | null): Promise<void> => {
  try {
    if (password === null) {
      await SecureStore.deleteItemAsync(WIFI_AP_PASSWORD_KEY)
      return
    }
    await SecureStore.setItemAsync(WIFI_AP_PASSWORD_KEY, password)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to persist WiFi AP password: ${msg}`)
  }
}

export const getWifiApPassword = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(WIFI_AP_PASSWORD_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to read WiFi AP password: ${msg}`)
    return null
  }
}

export const clearWifiApPassword = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(WIFI_AP_PASSWORD_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to clear WiFi AP password: ${msg}`)
  }
}
