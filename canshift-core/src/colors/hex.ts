import type { HexColor } from '../schemas/common.js'

export const HEX_REGEX = /^#([0-9a-fA-F]{6})$/

export const isHexColor = (value: string): value is HexColor => HEX_REGEX.test(value)
