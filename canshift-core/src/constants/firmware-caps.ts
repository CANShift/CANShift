// firmware-caps.ts — hard caps and ranges shared with the firmware
//
// Mirrors canshift-firmware/include/app_config.h hard caps.
// MAX_TOPBAR_ITEMS is not yet in app_config.h (chosen at 16 here, cross-checked
// firmware-side at load time). Keep these in sync if the firmware caps change.

export const FIRMWARE_CAPS = {
  MAX_PAGES: 4,
  MAX_WIDGETS_PER_PAGE: 12,
  MAX_TOPBAR_ITEMS: 16,
  MAX_SIGNALS: 32,
  MAX_BUTTON_ACTIONS: 4,
} as const

export const CANVAS = {
  WIDTH: 320,
  HEIGHT: 240,
} as const

export const TOPBAR_HEIGHT = { MIN: 16, MAX: 60 } as const
export const REV_LIMIT_RPM = { MIN: 1, MAX: 20000 } as const
export const DECIMAL_PLACES = { MIN: 0, MAX: 4 } as const
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
