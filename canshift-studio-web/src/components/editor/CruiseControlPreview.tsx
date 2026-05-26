// CruiseControlPreview.tsx — Read-only canvas preview for the `cruise_control`
// page template (issue #451).
//
// The firmware draws the four touch-targets (+, −, SET, OFF) procedurally
// from `PageManager::buildPage`; this component mirrors that fixed 2×2 grid
// in the studio canvas so the user has a visual anchor for what the device
// will render. The layout numbers below MUST stay in lock-step with the
// firmware constants in `canshift-firmware/src/ui/page_manager.cpp`
// (`CRUISE_*` block) — if you tweak one, tweak both.

import type { PagePalette } from '@tmbk/canshift-core'

// Firmware-pixel layout — 2×2 grid centred under the (optional) top bar.
// Sized for thumb taps on the 320×240 panel: each button is 140×85 fw-px,
// well above the issue-#117 minimum (48×48 fw-px).
const BUTTON_W = 140
const BUTTON_H = 85
const GAP_X = 12
const GAP_Y = 10
// 8 px outer padding so the buttons don't kiss the canvas edge.
const OUTER_PAD = 8

interface CruiseButton {
  label: string
  /** Short tooltip describing the dispatched action — surfaced in the preview. */
  hint: string
  /** Cruise-control op this button will dispatch on-device. */
  op: 'increment' | 'decrement' | 'set' | 'off'
}

const BUTTONS: readonly CruiseButton[] = [
  { label: '+', hint: 'Increment setpoint', op: 'increment' },
  { label: 'SET', hint: 'Capture current speed', op: 'set' },
  { label: '−', hint: 'Decrement setpoint', op: 'decrement' },
  { label: 'OFF', hint: 'Disable cruise', op: 'off' },
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

/**
 * Static 2×2 grid mirroring the firmware's `cruise_control` template layout.
 * Buttons are non-interactive: this is a preview, not a controller.
 */
export function CruiseControlPreview({
  scale,
  canvasW,
  contentH,
  palette,
}: CruiseControlPreviewProps) {
  const fwCanvasW = canvasW / scale
  const fwContentH = contentH / scale

  // Centre the grid horizontally; vertically pin to the content area's top
  // padding so the buttons hug the top bar without overlapping it.
  const gridW = BUTTON_W * 2 + GAP_X
  const gridH = BUTTON_H * 2 + GAP_Y
  const startX = Math.max(OUTER_PAD, Math.round((fwCanvasW - gridW) / 2))
  const startY = Math.max(OUTER_PAD, Math.round((fwContentH - gridH) / 2))

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
      data-testid="cruise-control-preview"
    >
      {BUTTONS.map((btn, idx) => {
        const col = idx % 2
        const row = Math.floor(idx / 2)
        const x = (startX + col * (BUTTON_W + GAP_X)) * scale
        const y = (startY + row * (BUTTON_H + GAP_Y)) * scale
        const w = BUTTON_W * scale
        const h = BUTTON_H * scale
        return (
          <div
            key={btn.op}
            title={`${btn.label} — ${btn.hint}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: h,
              background: palette.surface,
              border: `2px solid ${palette.primary}`,
              borderRadius: 8 * scale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.text,
              fontSize: Math.round(28 * scale),
              fontWeight: 700,
              fontFamily: 'sans-serif',
              opacity: 0.92,
            }}
          >
            {btn.label}
          </div>
        )
      })}
      {/* Footer hint — anchors the preview as a template, not a live widget set. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 4 * scale,
          textAlign: 'center',
          color: palette.textDim,
          fontSize: Math.round(9 * scale),
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Cruise control template (rendered by firmware)
      </div>
    </div>
  )
}
