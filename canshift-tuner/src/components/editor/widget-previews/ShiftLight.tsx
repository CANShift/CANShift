import { memo } from 'react'
import { SHIFT_LIGHT, shiftLightLitSegments } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../../stores/dashboard.store'
import { effectiveValue } from './gauge-math'
import { type BaseRendererProps } from './shared'

export interface ShiftLightRendererProps extends BaseRendererProps {
  testValue?: number | null
}

export const ShiftLightPreview = memo(function ShiftLightPreview({
  widget,
  w,
  h,
  testValue,
}: ShiftLightRendererProps) {
  const revLimit = useDashboardStore((s) => s.config?.revLimitRpm ?? 0)
  if (widget.config.type !== 'shift_light') return null
  const cfg = widget.config
  const st = widget.style

  const fullValue = revLimit > cfg.startValue ? revLimit : cfg.startValue + 1
  const { raw: demoValue } = effectiveValue(testValue, cfg.startValue, fullValue)
  const lit = shiftLightLitSegments(demoValue, cfg.startValue, fullValue)

  const gap = SHIFT_LIGHT.gapPx
  const segW = (w - gap * (SHIFT_LIGHT.segments - 1)) / SHIFT_LIGHT.segments
  const redFrom =
    cfg.redSegments >= SHIFT_LIGHT.segments ? 0 : SHIFT_LIGHT.segments - cfg.redSegments

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {Array.from({ length: SHIFT_LIGHT.segments }, (_, i) => {
        const fill =
          i >= lit ? SHIFT_LIGHT.trackColor : i >= redFrom ? SHIFT_LIGHT.redColor : st.textColor
        return <rect key={i} x={i * (segW + gap)} y={0} width={segW} height={h} fill={fill} />
      })}
    </svg>
  )
})
