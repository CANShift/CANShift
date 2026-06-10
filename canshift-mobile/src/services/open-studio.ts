import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { ESP32_AP_IP } from '../constants/ota'
import { isAllowedExternalUrl } from '../lib/safe-url'
import { log } from '../stores/log.store'

const STUDIO_MDNS_HOST = 'canshift.local' as const

const STUDIO_PRIMARY_URL = `http://${STUDIO_MDNS_HOST}/` as const

const STUDIO_FALLBACK_URL = `http://${ESP32_AP_IP}/` as const

export const STUDIO_URL_CANDIDATES = [STUDIO_PRIMARY_URL, STUDIO_FALLBACK_URL] as const

export const getStudioUrl = (): string => {
  return STUDIO_PRIMARY_URL
}

export const openStudioInBrowser = async (url: string): Promise<void> => {
  if (!isAllowedExternalUrl(url)) {
    throw new Error(`openStudioInBrowser: blocked URL scheme — ${url}`)
  }
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `expo-web-browser unavailable, falling back to Linking: ${msg}`)
    await Linking.openURL(url)
  }
}
