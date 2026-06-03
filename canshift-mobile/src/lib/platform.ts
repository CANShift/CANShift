// platform.ts — Typed platform identity for error-metadata tagging.
//
// `Platform.OS` from React Native is widened to a `'ios' | 'android' | 'web'
// | 'windows' | 'macos'` union — every caller that wants to slot it into a
// "where did this error fire" payload would otherwise have to repeat the
// same `=== 'android' ? 'android' : 'ios'` narrowing inline.
//
// The function is NOT a behavioural branch (which CLAUDE.md routes through
// `.ios.ts` / `.android.ts` files). It's a typed accessor of the platform
// identifier used by ble.service.ts and ble.errors.ts when constructing
// `BlePermissionDeniedError`-shaped error objects whose `platform` field
// the UI matches against to pick the right "open Settings" deep link.
// Issue #1017 M-HI-4.

import { Platform } from 'react-native'

export type MobilePlatform = 'ios' | 'android'

/** Returns the current platform tag for error/diagnostic payloads.
 *
 * Collapses every non-Android target to `'ios'` because the Expo build
 * config in this repo only ships iOS and Android — a future web / macOS
 * surface would need an explicit case here. */
export function currentPlatform(): MobilePlatform {
  return Platform.OS === 'android' ? 'android' : 'ios'
}
