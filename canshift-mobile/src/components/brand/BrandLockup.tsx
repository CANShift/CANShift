import React from 'react'
import Svg, { G, Path } from 'react-native-svg'
import {
  BASELINE_TEXT_PATH,
  BRAND_ACCENT,
  BRAND_PAPER,
  LOCKUP_BASELINE_OPACITY,
  LOCKUP_BASELINE_TRANSFORM,
  LOCKUP_BASELINE_VIEWBOX,
  LOCKUP_DIVIDER,
  LOCKUP_MONOGRAM_TRANSFORM,
  LOCKUP_WORDMARK_TRANSFORM,
  MONOGRAM_C_PATH,
  MONOGRAM_S_PATH,
  MONOGRAM_STROKE_WIDTH,
  WORDMARK_CAN_PATH,
  WORDMARK_SHIFT_PATH,
} from '@tmbk/canshift-core'

export interface BrandLockupProps {
  width: number
  maxHeight?: number
}

const VIEWBOX_WIDTH = 590
const VIEWBOX_HEIGHT = 190

const fittedWidth = (width: number, maxHeight?: number): number =>
  maxHeight === undefined ? width : Math.min(width, (maxHeight * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT)

export const BrandLockup = ({ width, maxHeight }: BrandLockupProps) => (
  <Svg
    viewBox={LOCKUP_BASELINE_VIEWBOX}
    width={fittedWidth(width, maxHeight)}
    height={(fittedWidth(width, maxHeight) * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
    accessibilityRole="image"
    accessibilityLabel="CANShift — dash CANbus firmware"
  >
    <G transform={LOCKUP_MONOGRAM_TRANSFORM} fill="none" strokeLinecap="butt">
      <Path d={MONOGRAM_C_PATH} stroke={BRAND_PAPER} strokeWidth={MONOGRAM_STROKE_WIDTH} />
      <Path d={MONOGRAM_S_PATH} stroke={BRAND_ACCENT} strokeWidth={MONOGRAM_STROKE_WIDTH} />
    </G>
    <Path
      d={`M${String(LOCKUP_DIVIDER.x)} ${String(LOCKUP_DIVIDER.y)} h${String(LOCKUP_DIVIDER.width)} v${String(LOCKUP_DIVIDER.height)} h-${String(LOCKUP_DIVIDER.width)} Z`}
      fill={BRAND_PAPER}
      opacity={LOCKUP_DIVIDER.opacity}
    />
    <G transform={LOCKUP_WORDMARK_TRANSFORM}>
      <Path fill={BRAND_PAPER} d={WORDMARK_CAN_PATH} />
      <Path fill={BRAND_ACCENT} d={WORDMARK_SHIFT_PATH} />
    </G>
    <G transform={LOCKUP_BASELINE_TRANSFORM} opacity={LOCKUP_BASELINE_OPACITY}>
      <Path fill={BRAND_PAPER} d={BASELINE_TEXT_PATH} />
    </G>
  </Svg>
)
