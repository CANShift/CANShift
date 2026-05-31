// open-studio.ts — Open the dash-hosted Studio SPA in an in-app browser.
//
// The dash exposes the Studio editor over HTTP on its WiFi AP (post #1077):
// the user joins the dashboard's CANShift-XXXX AP and the firmware serves the
// SPA at `http://canshift.local/` (mDNS) and `http://192.168.4.1/` (static AP
// gateway). On iOS, .local resolves natively via Bonjour; the static IP works
// on every platform because it sidesteps DNS entirely.
//
// We don't probe the URLs before opening — letting the OS surface a clear
// DNS / connection error is both faster and friendlier than a fetch round-trip
// over a flaky AP that may still be coming up.

import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { ESP32_AP_IP } from '../constants/ota'
import { isAllowedExternalUrl } from '../lib/safe-url'
import { log } from '../stores/log.store'

/** mDNS hostname the firmware advertises while the AP is up. */
const STUDIO_MDNS_HOST = 'canshift.local' as const

/** Preferred URL: mDNS hostname — user-friendly, works on iOS and most Android. */
const STUDIO_PRIMARY_URL = `http://${STUDIO_MDNS_HOST}/` as const

/** Fallback URL: static AP gateway IP — sidesteps DNS, always works on the AP. */
const STUDIO_FALLBACK_URL = `http://${ESP32_AP_IP}/` as const

/**
 * Candidate URLs to reach the Studio SPA, in preferred order:
 *   1. mDNS hostname — user-friendly, works on iOS and most Android setups
 *   2. Static AP gateway IP — sidesteps DNS, always works when on the AP
 *
 * The OTA flow does not cache a session-specific IP — the dash AP is always
 * at the static `ESP32_AP_IP`, so that constant doubles as the "cached IP"
 * referenced in the open-studio user flow.
 */
export const STUDIO_URL_CANDIDATES = [STUDIO_PRIMARY_URL, STUDIO_FALLBACK_URL] as const

/**
 * Returns the URL the in-app browser should open. We pick the mDNS host —
 * if the OS can't resolve it the in-app browser surfaces a clear error and
 * the user can retry; pre-probing would only delay that outcome and would
 * risk falsely rejecting a slow-but-working mDNS resolver.
 */
export function getStudioUrl(): string {
  return STUDIO_PRIMARY_URL
}

/**
 * Open the Studio SPA inside an in-app browser. Prefers `expo-web-browser`
 * (Safari View Controller on iOS, Chrome Custom Tabs on Android — keeps the
 * user inside the app's process). Falls back to `Linking.openURL` if the
 * module isn't available at runtime (defensive — the dep is declared, but a
 * stale dev build might lack the native side).
 */
export async function openStudioInBrowser(url: string): Promise<void> {
  // Defence in depth (#1013). `getStudioUrl()` returns a fixed http(s) URL
  // today, but a future caller could route a user-controlled string here.
  // Block anything that isn't HTTPS / HTTP / mailto before either branch.
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
