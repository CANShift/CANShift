import { memo } from 'react'
import { FONT_FAMILY } from '../widgetPreview.styles'
import type { BaseRendererProps } from './shared'

const FRAME_BG = '#1A1A1A'
const FRAME_STROKE = '#2A2A2A'
const GLYPH_STROKE = '#333333'
const CAPTION_RGB = '#2A2A2A'

export const ImagePreview = memo(function ImagePreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'image') return null

  const points = [
    `${String(w * 0.2)},${String(h * 0.72)}`,
    `${String(w * 0.42)},${String(h * 0.38)}`,
    `${String(w * 0.58)},${String(h * 0.55)}`,
    `${String(w * 0.7)},${String(h * 0.42)}`,
    `${String(w * 0.82)},${String(h * 0.72)}`,
  ].join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      <rect
        x={4}
        y={4}
        width={Math.max(0, w - 8)}
        height={Math.max(0, h - 8)}
        fill={FRAME_BG}
        rx={3}
        stroke={FRAME_STROKE}
      />
      <polyline points={points} fill="none" stroke={GLYPH_STROKE} strokeWidth={1.5} />
      <circle cx={w * 0.3} cy={h * 0.35} r={Math.min(w, h) * 0.06} fill={GLYPH_STROKE} />
      <text
        x={w / 2}
        y={h - 6}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={CAPTION_RGB}
        fontSize={Math.max(5, Math.min(7, w * 0.07))}
        fontFamily={FONT_FAMILY}
        fontWeight="500"
        letterSpacing="0.05em"
      >
        IMAGE
      </text>
    </svg>
  )
})
