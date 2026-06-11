import { memo } from 'react'
import { SensorIcon } from '../../icons/SensorIcons'
import type { BaseRendererProps } from './shared'

export interface ButtonRendererProps extends BaseRendererProps {
  active: boolean
  cycleStateIndex?: number | undefined
}

export const computeButtonPreviewMetrics = (
  w: number,
  h: number,
  showIcon: boolean
): { iconSize: number; fontSize: number } => {
  const iconSize = showIcon ? Math.max(18, Math.min(h * 0.75, h - 14, w * 0.7, 56)) : 0
  const labelBudget = w - 12
  const verticalBudget = showIcon ? Math.min(h * 0.2, iconSize * 0.4) : h * 0.48
  const fontSize = Math.max(8, Math.min(verticalBudget, labelBudget * 0.22))
  return { iconSize, fontSize }
}

export const ButtonPreview = memo(function ButtonPreview({
  widget,
  w,
  h,
  active,
  cycleStateIndex,
}: ButtonRendererProps) {
  if (widget.config.type !== 'button') return null
  const cfg = widget.config
  const st = widget.style

  const activeStateIdx = cfg.mode === 'cycle' ? (cycleStateIndex ?? cfg.initialActiveIndex) : null
  const activeState =
    cfg.mode === 'cycle' && activeStateIdx !== null ? cfg.states[activeStateIdx] : null

  const displayLabel = activeState?.label ?? cfg.label
  const displayIconName = activeState?.iconName ?? cfg.iconName ?? null
  const displayColors = activeState?.colors ?? cfg.colors

  const showIcon = cfg.showIcon === true && displayIconName !== null
  const showLabel = cfg.showLabel !== false
  const { iconSize, fontSize } = computeButtonPreviewMetrics(w, h, showIcon)

  const normalColor = displayColors?.normal ?? st.primaryColor
  const activeColor = displayColors?.active ?? st.primaryColor
  const stateColor = active ? activeColor : normalColor
  const bgColor = active ? activeColor + '55' : normalColor + '18'
  const borderColor = active ? activeColor : st.secondaryColor
  const textColor = active ? stateColor : st.textColor

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '4px 6px',
        boxSizing: 'border-box',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 0,
        overflow: 'visible',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {showIcon && displayIconName !== null && (
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <SensorIcon name={displayIconName} size={iconSize} color={textColor + 'CC'} />
        </div>
      )}
      {showLabel && (
        <span
          style={{
            color: textColor,
            fontSize,
            fontWeight: 500,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflow: 'visible',
            letterSpacing: '0.04em',
            minWidth: 0,
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {displayLabel}
        </span>
      )}
    </div>
  )
})
