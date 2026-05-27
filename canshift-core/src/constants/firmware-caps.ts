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
  MAX_RAMP_STOPS: 8,
} as const

/**
 * Maximum number of stops a `ColorRamp` may carry (issue #430). Mirrored as
 * `CFG_MAX_RAMP_STOPS` in `canshift-firmware/include/app_config.h` — keep in
 * sync. The cap is generous enough for green→orange→red gradients with extra
 * intermediate hues while keeping the firmware-side fixed array small.
 */
export const MAX_RAMP_STOPS = FIRMWARE_CAPS.MAX_RAMP_STOPS

export const CANVAS = {
  WIDTH: 320,
  HEIGHT: 240,
} as const

export const TOPBAR_HEIGHT = { MIN: 16, MAX: 60 } as const
export const REV_LIMIT_RPM = { MIN: 1, MAX: 20000 } as const
export const DECIMAL_PLACES = { MIN: 0, MAX: 4 } as const
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

// CAN 2.0 frames carry up to 8 data bytes => 16 hex characters.
// Empty string = zero-byte frame (legal). Must be even-length pure hex.
export const CAN_RAW_DATA_MAX_HEX_CHARS = 16
export const CAN_RAW_DATA_REGEX = /^([0-9a-fA-F]{2})*$/

/** Number of data bytes in a CAN 2.0 frame — mirrors `kCanFrameMaxBytes` in firmware. */
export const CAN_FRAME_MAX_BYTES = 8
