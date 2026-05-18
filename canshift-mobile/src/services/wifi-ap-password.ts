// wifi-ap-password.ts — persist the firmware's transient WiFi-AP password
// via SecureStore. The password is a device secret (bootstraps OTA over
// HTTP). Keeping it out of the Zustand store closes #890 — React Devtools
// can't enumerate it any more, and a stray debug `log()` line can't leak
// it through the in-memory state slice.

import * as SecureStore from 'expo-secure-store'
import { log } from '../stores/log.store'

const WIFI_AP_PASSWORD_KEY = 'canshift.wifiApPassword'

export async function setWifiApPassword(password: string | null): Promise<void> {
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

export async function getWifiApPassword(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(WIFI_AP_PASSWORD_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to read WiFi AP password: ${msg}`)
    return null
  }
}

export async function clearWifiApPassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(WIFI_AP_PASSWORD_KEY)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `Failed to clear WiFi AP password: ${msg}`)
  }
}
