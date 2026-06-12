import { memo } from 'react'
import { BLINK_ANIM, FONT_FAMILY } from '../widgetPreview.styles'
import { FRAC_FONT_SCALE, effectiveValue, splitDecimal } from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface GaugeNumericRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

export const GaugeNumericPreview = memo(function GaugeNumericPreview({
  widget,
  w,
  h,
  danger,
  testValue,
  signalUnit,
}: GaugeNumericRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const { raw: demoValue } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
  const valueOnly = demoValue.toFixed(cfg.decimalPlaces)
  const prefix = cfg.prefix ?? ''

  const valueColor = st.textColor

  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = 14
  const availH = h - sigHeaderH

  const valueStr = String(valueOnly)
  const intLen = valueStr.includes('.') ? valueStr.split('.')[0]!.length : valueStr.length
  const willSplit = !cfg.prefix && intLen > 3 && !valueStr.includes('.')
  const headChars = willSplit ? intLen - 3 : intLen
  const tailChars = willSplit ? 3 : valueStr.includes('.') ? valueStr.length - intLen : 0
  const unitChars = signalUnit.length
  const charBudget = headChars + tailChars * FRAC_FONT_SCALE + unitChars * FRAC_FONT_SCALE * 0.45
  const fontSize = Math.max(10, Math.min(availH * 0.85, (w - 16) / (charBudget * 0.68)))

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${String(sigHeaderH + 2)}px 4px 2px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        gap: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          fontSize: 9,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          color: '#888888',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: `calc(100% - 8px)`,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {signalLabel.toUpperCase()}
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          flexShrink: 0,
        }}
      >
        {(() => {
          const { int, frac } = splitDecimal(valueOnly)
          const isWideInt = !prefix && int.length > 3 && frac === ''
          const intHead = isWideInt ? int.slice(0, -3) : int
          const intTail = isWideInt ? int.slice(-3) : ''
          return (
            <span
              style={{
                color: valueColor,
                fontFamily: FONT_FAMILY,
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'clip',
                textAlign: 'center',
                animation: danger ? BLINK_ANIM : undefined,
              }}
            >
              <span style={{ fontSize }}>{prefix + intHead}</span>
              {intTail !== '' && (
                <span style={{ fontSize: fontSize * FRAC_FONT_SCALE }}>{intTail}</span>
              )}
              {frac !== '' && <span style={{ fontSize: fontSize * FRAC_FONT_SCALE }}>{frac}</span>}
            </span>
          )
        })()}
        {signalUnit !== '' && (
          <span
            style={{
              color: '#888888',
              fontSize: Math.max(8, Math.min(fontSize * 0.32, 14)),
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {signalUnit}
          </span>
        )}
      </div>
    </div>
  )
})
