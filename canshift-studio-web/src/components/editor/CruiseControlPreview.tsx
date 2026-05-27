// CruiseControlPreview.tsx — Read-only canvas preview for the `cruise_control`
// page template (issue #451).
//
// The firmware draws the four touch-targets (+, −, SET, OFF) procedurally
// from `PageManager::buildPage`; this component mirrors that layout in the
// studio canvas. Layout: four L-shaped corner buttons that wrap around a
// centred SET-SPEED display rectangle. The L-notch on each button is a
// CSS clip-path polygon — keeps the corners crisp at every render scale
// without needing SVG.
//
// The layout numbers below MUST stay in lock-step with the firmware constants
// in `canshift-firmware/src/ui/page_manager.cpp` (`CRUISE_*` block) — if you
// tweak one, tweak both.

import type { PagePalette } from '@tmbk/canshift-core'

// All sizes in firmware pixels — the SCALE prop maps to display px.
const OUTER_PAD = 6
const CENTER_W = 100
const CENTER_H = 76
const NOTCH_MARGIN = 6

// Placeholder set speed shown in preview only. Firmware feeds the live value
// from the cruise control state machine.
const DEMO_SET_SPEED = 100
const SPEED_UNIT = 'km/h'

interface CruiseButton {
  label: string
  /** Short tooltip describing the dispatched action — surfaced in the preview. */
  hint: string
  /** Cruise-control op this button will dispatch on-device. */
  op: 'increment' | 'decrement' | 'set' | 'off'
  /** Which quadrant the button occupies. Drives notch orientation + position. */
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const BUTTONS: readonly CruiseButton[] = [
  { label: '+', hint: 'Increment setpoint', op: 'increment', corner: 'top-left' },
  { label: '−', hint: 'Decrement setpoint', op: 'decrement', corner: 'top-right' },
  { label: 'SET', hint: 'Capture current speed', op: 'set', corner: 'bottom-left' },
  { label: 'OFF', hint: 'Disable cruise', op: 'off', corner: 'bottom-right' },
]

interface CruiseControlPreviewProps {
  /** Render scale — canvas px per firmware px (matches Canvas SCALE). */
  scale: number
  /** Canvas width in display px (i.e. screen profile width × scale). */
  canvasW: number
  /** Canvas height in display px below the top bar. */
  contentH: number
  /** Active page palette — colours the buttons consistently with the rest of the UI. */
  palette: PagePalette
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function computeLayout(fwCanvasW: number, fwContentH: number) {
  const centerX = Math.round((fwCanvasW - CENTER_W) / 2)
  const centerY = Math.round((fwContentH - CENTER_H) / 2)
  const center: Box = { x: centerX, y: centerY, w: CENTER_W, h: CENTER_H }

  // Each button fills its quadrant from the outer pad up to the canvas
  // midline. The notch is cut from the corner facing the centre rectangle.
  const halfW = Math.round(fwCanvasW / 2)
  const halfH = Math.round(fwContentH / 2)

  const topLeft: Box = {
    x: OUTER_PAD,
    y: OUTER_PAD,
    w: halfW - OUTER_PAD - 2,
    h: halfH - OUTER_PAD - 2,
  }
  const topRight: Box = {
    x: halfW + 2,
    y: OUTER_PAD,
    w: fwCanvasW - halfW - OUTER_PAD - 2,
    h: halfH - OUTER_PAD - 2,
  }
  const bottomLeft: Box = {
    x: OUTER_PAD,
    y: halfH + 2,
    w: halfW - OUTER_PAD - 2,
    h: fwContentH - halfH - OUTER_PAD - 2,
  }
  const bottomRight: Box = {
    x: halfW + 2,
    y: halfH + 2,
    w: fwCanvasW - halfW - OUTER_PAD - 2,
    h: fwContentH - halfH - OUTER_PAD - 2,
  }

  return { center, topLeft, topRight, bottomLeft, bottomRight }
}

// CSS clip-path polygon points are percentages of the element bounding box.
// Builds the L-shape by cutting the corner of `corner` that faces the centre
// rectangle. `cutW` / `cutH` are the notch dimensions in fw-px, projected
// onto the button bounding box.
function buttonClipPath(box: Box, corner: CruiseButton['corner'], cutW: number, cutH: number): string {
  const xPct = (cutW / box.w) * 100
  const yPct = (cutH / box.h) * 100
  // For each corner orientation, walk the polygon clockwise so the L-notch
  // bites into the corner facing the centre. All other corners stay square.
  switch (corner) {
    case 'top-left':
      // Notch on bottom-right.
      return `polygon(0% 0%, 100% 0%, 100% ${String(100 - yPct)}%, ${String(100 - xPct)}% ${String(100 - yPct)}%, ${String(100 - xPct)}% 100%, 0% 100%)`
    case 'top-right':
      // Notch on bottom-left.
      return `polygon(0% 0%, 100% 0%, 100% 100%, ${String(xPct)}% 100%, ${String(xPct)}% ${String(100 - yPct)}%, 0% ${String(100 - yPct)}%)`
    case 'bottom-left':
      // Notch on top-right.
      return `polygon(0% 0%, ${String(100 - xPct)}% 0%, ${String(100 - xPct)}% ${String(yPct)}%, 100% ${String(yPct)}%, 100% 100%, 0% 100%)`
    case 'bottom-right':
      // Notch on top-left.
      return `polygon(${String(xPct)}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${String(yPct)}%, ${String(xPct)}% ${String(yPct)}%)`
  }
}

/**
 * Four L-shaped corner buttons surrounding a centred SET-SPEED rectangle.
 * Mirrors the firmware's procedural cruise_control layout. Buttons are
 * non-interactive — this is a preview, not a controller.
 */
export function CruiseControlPreview({
  scale,
  canvasW,
  contentH,
  palette,
}: CruiseControlPreviewProps) {
  const fwCanvasW = canvasW / scale
  const fwContentH = contentH / scale
  const layout = computeLayout(fwCanvasW, fwContentH)

  // Notch size in fw-px: half the centre rect + margin, so each button's
  // notch lines up exactly with the centre's outer edge plus the breathing
  // margin requested by the user (no button can crowd the rectangle).
  const notchW = Math.round(CENTER_W / 2 + NOTCH_MARGIN)
  const notchH = Math.round(CENTER_H / 2 + NOTCH_MARGIN)

  const buttonBoxes: Record<CruiseButton['corner'], Box> = {
    'top-left': layout.topLeft,
    'top-right': layout.topRight,
    'bottom-left': layout.bottomLeft,
    'bottom-right': layout.bottomRight,
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      data-testid="cruise-control-preview"
    >
      {BUTTONS.map((btn) => {
        const box = buttonBoxes[btn.corner]
        return (
          <div
            key={btn.op}
            title={`${btn.label} — ${btn.hint}`}
            style={{
              position: 'absolute',
              left: box.x * scale,
              top: box.y * scale,
              width: box.w * scale,
              height: box.h * scale,
              background: palette.surface,
              border: `2px solid ${palette.primary}`,
              borderRadius: 6 * scale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.text,
              fontSize: Math.round(28 * scale),
              fontWeight: 700,
              fontFamily: 'sans-serif',
              opacity: 0.92,
              clipPath: buttonClipPath(box, btn.corner, notchW, notchH),
            }}
          >
            {btn.label}
          </div>
        )
      })}

      {/* Centre SET-SPEED display — sits inside the notch every button cut out
          of its inner corner. Larger digit + small unit label below. */}
      <div
        style={{
          position: 'absolute',
          left: layout.center.x * scale,
          top: layout.center.y * scale,
          width: layout.center.w * scale,
          height: layout.center.h * scale,
          background: palette.surface,
          border: `2px solid ${palette.primary}`,
          borderRadius: 10 * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.text,
          fontFamily: 'sans-serif',
          gap: 2 * scale,
        }}
      >
        <span
          style={{
            fontSize: Math.round(9 * scale),
            color: palette.textDim,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Set
        </span>
        <span
          style={{
            fontSize: Math.round(34 * scale),
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}
        >
          {DEMO_SET_SPEED}
        </span>
        <span
          style={{
            fontSize: Math.round(9 * scale),
            color: palette.textDim,
            letterSpacing: '0.04em',
          }}
        >
          {SPEED_UNIT}
        </span>
      </div>
    </div>
  )
}
