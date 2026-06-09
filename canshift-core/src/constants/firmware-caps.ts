// firmware-caps.ts — hard caps and ranges shared with the firmware
//
// Mirrors canshift-firmware/include/app_config.h hard caps.
// MAX_TOPBAR_ITEMS is not yet in app_config.h (chosen at 16 here, cross-checked
// firmware-side at load time). Keep these in sync if the firmware caps change.

export const FIRMWARE_CAPS = {
  // 4 → 8 in #1357 over-ate runtime heap (CAN + USB OOM, reverted in #1358).
  // 4 → 5 in #1360 is the minimal bump that fits the demo seed (4 pages) + 1
  // cruise_control page without flirting with the fragmentation cliff.
  // Heap-allocating the page array (issue #1359) is the durable fix.
  MAX_PAGES: 5,
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

// CAN 2.0 frames carry at most 8 data bytes — a signal's `startByte` must fit
// inside the frame, so the legal range is [0, CAN_FRAME_MAX_BYTES - 1].
export const CAN_FRAME_MAX_BYTES = 8

// Bounds for `WidgetStyle.fontSize` — keeps text legible on the 320×240 canvas
// without blowing past LVGL's largest preloaded glyph (~48px in Orbitron).
export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 48

// `MapSwitchAction.mapIndex` is encoded as a 0-based byte the firmware sends
// as `mapIndex + 1` on the wire (1..8). The schema accepts the domain form.
export const MAP_INDEX_MAX = 7

// Largest CAN 2.0B 29-bit extended identifier. Standard (11-bit) IDs fit in
// the lower 0x7FF; the schema accepts both since `CanRawAction.extended`
// picks the framing.
export const CAN_29BIT_MAX = 0x1fffffff

// Upper bounds on free-form string fields the firmware copies into fixed C
// buffers. Over-limit values would truncate (or, worse, overflow) on-device,
// so the schema rejects them at the boundary (#1170).
export const STRING_CAPS = {
  SIGNAL_NAME: 63,
  SIGNAL_UNIT: 15,
  WIDGET_LABEL: 64,
  WIDGET_PREFIX_SUFFIX: 32,
  ICON_PATH: 256,
  IMAGE_PATH: 256,
  PROTOCOL: 64,
  BINDING_SIGNAL: 64,
} as const
