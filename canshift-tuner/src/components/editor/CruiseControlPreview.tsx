import type { PagePalette } from '@tmbk/canshift-core'
import { FONT_FAMILY } from './widgetPreview.styles'

const OUTER_PAD = 6
const CENTER_W = 100
const CENTER_H = 76
const NOTCH_MARGIN = 6
const CORNER_R = 8
const INNER_R = 5
const LABEL_PAD = 10
const STROKE_W = 2

const DEMO_SET_SPEED = 0
const SPEED_UNIT = 'km/h'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface CruiseButton {
  label: string
  hint: string
  op: 'increment' | 'decrement' | 'set' | 'off'
  corner: Corner
}

const BUTTONS: readonly CruiseButton[] = [
  { label: '−', hint: 'Decrement setpoint', op: 'decrement', corner: 'top-left' },
  { label: '+', hint: 'Increment setpoint', op: 'increment', corner: 'top-right' },
  { label: 'SET', hint: 'Capture current speed', op: 'set', corner: 'bottom-left' },
  { label: 'OFF', hint: 'Disable cruise', op: 'off', corner: 'bottom-right' },
]

interface CruiseControlPreviewProps {
  scale: number
  canvasW: number
  contentH: number
  palette: PagePalette
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const computeLayout = (fwCanvasW: number, fwContentH: number) => {
  const centerX = Math.round((fwCanvasW - CENTER_W) / 2)
  const centerY = Math.round((fwContentH - CENTER_H) / 2)
  const center: Box = { x: centerX, y: centerY, w: CENTER_W, h: CENTER_H }

  const halfW = Math.round(fwCanvasW / 2)
  const halfH = Math.round(fwContentH / 2)

  return {
    center,
    'top-left': {
      x: OUTER_PAD,
      y: OUTER_PAD,
      w: halfW - OUTER_PAD - 2,
      h: halfH - OUTER_PAD - 2,
    } as Box,
    'top-right': {
      x: halfW + 2,
      y: OUTER_PAD,
      w: fwCanvasW - halfW - OUTER_PAD - 2,
      h: halfH - OUTER_PAD - 2,
    } as Box,
    'bottom-left': {
      x: OUTER_PAD,
      y: halfH + 2,
      w: halfW - OUTER_PAD - 2,
      h: fwContentH - halfH - OUTER_PAD - 2,
    } as Box,
    'bottom-right': {
      x: halfW + 2,
      y: halfH + 2,
      w: fwCanvasW - halfW - OUTER_PAD - 2,
      h: fwContentH - halfH - OUTER_PAD - 2,
    } as Box,
  }
}

const buttonPathD = (w: number, h: number, notchW: number, notchH: number, corner: Corner): string => {
  const r = CORNER_R
  const ir = INNER_R
  switch (corner) {
    case 'top-left':
      return [
        `M ${num(r)} 0`,
        `L ${num(w - r)} 0`,
        `Q ${num(w)} 0 ${num(w)} ${num(r)}`,
        `L ${num(w)} ${num(h - notchH - ir)}`,
        `Q ${num(w)} ${num(h - notchH)} ${num(w - ir)} ${num(h - notchH)}`,
        `L ${num(w - notchW + ir)} ${num(h - notchH)}`,
        `Q ${num(w - notchW)} ${num(h - notchH)} ${num(w - notchW)} ${num(h - notchH + ir)}`,
        `L ${num(w - notchW)} ${num(h - ir)}`,
        `Q ${num(w - notchW)} ${num(h)} ${num(w - notchW - ir)} ${num(h)}`,
        `L ${num(r)} ${num(h)}`,
        `Q 0 ${num(h)} 0 ${num(h - r)}`,
        `L 0 ${num(r)}`,
        `Q 0 0 ${num(r)} 0`,
        'Z',
      ].join(' ')
    case 'top-right':
      return [
        `M ${num(r)} 0`,
        `L ${num(w - r)} 0`,
        `Q ${num(w)} 0 ${num(w)} ${num(r)}`,
        `L ${num(w)} ${num(h - r)}`,
        `Q ${num(w)} ${num(h)} ${num(w - r)} ${num(h)}`,
        `L ${num(notchW + ir)} ${num(h)}`,
        `Q ${num(notchW)} ${num(h)} ${num(notchW)} ${num(h - ir)}`,
        `L ${num(notchW)} ${num(h - notchH + ir)}`,
        `Q ${num(notchW)} ${num(h - notchH)} ${num(notchW - ir)} ${num(h - notchH)}`,
        `L ${num(ir)} ${num(h - notchH)}`,
        `Q 0 ${num(h - notchH)} 0 ${num(h - notchH - ir)}`,
        `L 0 ${num(r)}`,
        `Q 0 0 ${num(r)} 0`,
        'Z',
      ].join(' ')
    case 'bottom-left':
      return [
        `M ${num(r)} 0`,
        `L ${num(w - notchW - ir)} 0`,
        `Q ${num(w - notchW)} 0 ${num(w - notchW)} ${num(ir)}`,
        `L ${num(w - notchW)} ${num(notchH - ir)}`,
        `Q ${num(w - notchW)} ${num(notchH)} ${num(w - notchW + ir)} ${num(notchH)}`,
        `L ${num(w - ir)} ${num(notchH)}`,
        `Q ${num(w)} ${num(notchH)} ${num(w)} ${num(notchH + ir)}`,
        `L ${num(w)} ${num(h - r)}`,
        `Q ${num(w)} ${num(h)} ${num(w - r)} ${num(h)}`,
        `L ${num(r)} ${num(h)}`,
        `Q 0 ${num(h)} 0 ${num(h - r)}`,
        `L 0 ${num(r)}`,
        `Q 0 0 ${num(r)} 0`,
        'Z',
      ].join(' ')
    case 'bottom-right':
      return [
        `M ${num(notchW + ir)} 0`,
        `L ${num(w - r)} 0`,
        `Q ${num(w)} 0 ${num(w)} ${num(r)}`,
        `L ${num(w)} ${num(h - r)}`,
        `Q ${num(w)} ${num(h)} ${num(w - r)} ${num(h)}`,
        `L ${num(r)} ${num(h)}`,
        `Q 0 ${num(h)} 0 ${num(h - r)}`,
        `L 0 ${num(notchH + ir)}`,
        `Q 0 ${num(notchH)} ${num(ir)} ${num(notchH)}`,
        `L ${num(notchW - ir)} ${num(notchH)}`,
        `Q ${num(notchW)} ${num(notchH)} ${num(notchW)} ${num(notchH - ir)}`,
        `L ${num(notchW)} ${num(ir)}`,
        `Q ${num(notchW)} 0 ${num(notchW + ir)} 0`,
        'Z',
      ].join(' ')
  }
}

const num = (v: number): string => {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

const labelCenter = (w: number, h: number, notchW: number, notchH: number, corner: Corner) => {
  const offsetX = Math.round(notchW / 4)
  const offsetY = Math.round(notchH / 4)
  switch (corner) {
    case 'top-left':
      return { x: w / 2 - offsetX, y: h / 2 - offsetY }
    case 'top-right':
      return { x: w / 2 + offsetX, y: h / 2 - offsetY }
    case 'bottom-left':
      return { x: w / 2 - offsetX, y: h / 2 + offsetY }
    case 'bottom-right':
      return { x: w / 2 + offsetX, y: h / 2 + offsetY }
  }
}

export const CruiseControlPreview = ({
  scale,
  canvasW,
  contentH,
  palette,
}: CruiseControlPreviewProps) => {
  const fwCanvasW = canvasW / scale
  const fwContentH = contentH / scale
  const layout = computeLayout(fwCanvasW, fwContentH)

  const notchW = Math.round(CENTER_W / 2 + NOTCH_MARGIN)
  const notchH = Math.round(CENTER_H / 2 + NOTCH_MARGIN)

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      data-testid="cruise-control-preview"
    >
      {BUTTONS.map((btn) => {
        const box = layout[btn.corner]
        const w = box.w
        const h = box.h
        const path = buttonPathD(w, h, notchW, notchH, btn.corner)
        const labelXY = labelCenter(w, h, notchW, notchH, btn.corner)
        const isSymbol = btn.label === '+' || btn.label === '−'
        const armBudget = Math.min(w - notchW - LABEL_PAD * 2, h - notchH - LABEL_PAD * 2)
        const labelFontSize = isSymbol
          ? Math.max(28, Math.min(56, armBudget))
          : Math.max(14, Math.min(28, armBudget * 0.7))
        return (
          <svg
            key={btn.op}
            width={w * scale}
            height={h * scale}
            viewBox={`0 0 ${String(w)} ${String(h)}`}
            style={{
              position: 'absolute',
              left: box.x * scale,
              top: box.y * scale,
              overflow: 'visible',
              opacity: 0.92,
            }}
            aria-label={`${btn.label} — ${btn.hint}`}
          >
            <title>{`${btn.label} — ${btn.hint}`}</title>
            <path
              d={path}
              fill={palette.surface}
              stroke={palette.primary}
              strokeWidth={STROKE_W}
              strokeLinejoin="round"
            />
            <text
              x={labelXY.x}
              y={labelXY.y}
              fill={palette.text}
              fontFamily={FONT_FAMILY}
              fontWeight={700}
              fontSize={labelFontSize}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {btn.label}
            </text>
          </svg>
        )
      })}

            <div
        style={{
          position: 'absolute',
          left: layout.center.x * scale,
          top: layout.center.y * scale,
          width: layout.center.w * scale,
          height: layout.center.h * scale,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2 * scale,
          color: palette.text,
          fontFamily: FONT_FAMILY,
        }}
      >
                <span
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            fontSize: 10 * scale,
            color: '#888888',
            lineHeight: 1,
            letterSpacing: '0.08em',
            textAlign: 'center',
          }}
        >
          SET
        </span>
                <span
          style={{
            color: palette.text,
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize: Math.round(40 * scale),
            lineHeight: 1,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {DEMO_SET_SPEED}
        </span>
                <span
          style={{
            color: '#888888',
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            fontSize: Math.max(8, Math.round(10 * scale)),
            lineHeight: 1,
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}
        >
          {SPEED_UNIT}
        </span>
      </div>
    </div>
  )
}
