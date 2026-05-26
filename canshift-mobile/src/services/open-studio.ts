// open-studio.ts — Open the dash-hosted Studio SPA in an in-app browser.
//
// `openStudioInBrowser` prefers `expo-web-browser` (Safari View Controller on
// iOS, Chrome Custom Tabs on Android — keeps the user inside the app's
// process), falling back to `Linking.openURL` if the native module is
// unavailable at runtime (defensive — the dep is declared, but a stale dev
// build might lack the native side).
//
// URL resolution lives in `getStudioUrl` (added in a follow-up commit).

import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { log } from '../stores/log.store'

/**
 * Open the Studio SPA inside an in-app browser. Errors from
 * `expo-web-browser` (e.g. missing native module) are logged and fall
 * through to `Linking.openURL`, which leaves the app but at least surfaces
 * the URL to the OS.
 */
export async function openStudioInBrowser(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    log('warn', `expo-web-browser unavailable, falling back to Linking: ${msg}`)
    await Linking.openURL(url)
  }
}
