import {
  BASELINE_TEXT_PATH,
  BRAND_ACCENT,
  LOCKUP_BASELINE_OPACITY,
  LOCKUP_BASELINE_TRANSFORM,
  LOCKUP_BASELINE_VIEWBOX,
  LOCKUP_DIVIDER,
  LOCKUP_MONOGRAM_TRANSFORM,
  LOCKUP_VIEWBOX,
  LOCKUP_WORDMARK_TRANSFORM,
  MONOGRAM_C_PATH,
  MONOGRAM_S_PATH,
  MONOGRAM_STROKE_WIDTH,
  WORDMARK_CAN_PATH,
  WORDMARK_SHIFT_PATH,
} from '@tmbk/canshift-core'

export interface BrandLockupProps {
  height: number
  withBaseline?: boolean
  label?: string
}

export const BrandLockup = ({
  height,
  withBaseline = false,
  label = 'CANShift',
}: BrandLockupProps) => {
  const viewBox = withBaseline ? LOCKUP_BASELINE_VIEWBOX : LOCKUP_VIEWBOX
  const viewBoxHeight = withBaseline ? 190 : 150
  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={(height * 590) / viewBoxHeight}
      role="img"
      aria-label={label}
    >
      <g transform={LOCKUP_MONOGRAM_TRANSFORM} fill="none" strokeLinecap="butt">
        <path d={MONOGRAM_C_PATH} stroke="currentColor" strokeWidth={MONOGRAM_STROKE_WIDTH} />
        <path d={MONOGRAM_S_PATH} stroke={BRAND_ACCENT} strokeWidth={MONOGRAM_STROKE_WIDTH} />
      </g>
      <rect
        x={LOCKUP_DIVIDER.x}
        y={LOCKUP_DIVIDER.y}
        width={LOCKUP_DIVIDER.width}
        height={LOCKUP_DIVIDER.height}
        fill="currentColor"
        opacity={LOCKUP_DIVIDER.opacity}
      />
      <g transform={LOCKUP_WORDMARK_TRANSFORM}>
        <path fill="currentColor" d={WORDMARK_CAN_PATH} />
        <path fill={BRAND_ACCENT} d={WORDMARK_SHIFT_PATH} />
      </g>
      {withBaseline ? (
        <g
          transform={LOCKUP_BASELINE_TRANSFORM}
          fill="currentColor"
          opacity={LOCKUP_BASELINE_OPACITY}
        >
          <path d={BASELINE_TEXT_PATH} />
        </g>
      ) : null}
    </svg>
  )
}
