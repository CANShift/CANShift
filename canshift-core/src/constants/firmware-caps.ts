export const FIRMWARE_CAPS = {
  MAX_PAGES: 8,
  MAX_WIDGETS_PER_PAGE: 12,
  MAX_TOPBAR_ITEMS: 16,
  MAX_SIGNALS: 32,
  MAX_BUTTON_ACTIONS: 4,
  MAX_RAMP_STOPS: 8,
} as const

export const MAX_RAMP_STOPS = FIRMWARE_CAPS.MAX_RAMP_STOPS

export const CANVAS = {
  WIDTH: 320,
  HEIGHT: 240,
} as const

export const TOPBAR_HEIGHT = { MIN: 16, MAX: 60 } as const
export const REV_LIMIT_RPM = { MIN: 1, MAX: 20000 } as const
export const DECIMAL_PLACES = { MIN: 0, MAX: 4 } as const
export { HEX_REGEX as HEX_COLOR_REGEX } from '../colors/hex.js'

export const CAN_RAW_DATA_MAX_HEX_CHARS = 16
export const CAN_RAW_DATA_REGEX = /^([0-9a-fA-F]{2})*$/

export const CAN_FRAME_MAX_BYTES = 8

export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 48

export const MAP_INDEX_MAX = 7

export const CAN_29BIT_MAX = 0x1fffffff

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
