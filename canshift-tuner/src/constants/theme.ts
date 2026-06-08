// theme.ts — Re-export shim over canshift-core's day-theme defaults.
//
// The actual constants live in `@tmbk/canshift-core/day-theme-defaults` since
// PR #901 — keeping the local re-exports here means we don't have to touch
// every Canvas / PropertyPanel / ScreenSettingsPanel import in one go.
// New code should import from `@tmbk/canshift-core` directly.

export { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT, DAY_THEME_PRESET } from '@tmbk/canshift-core'
