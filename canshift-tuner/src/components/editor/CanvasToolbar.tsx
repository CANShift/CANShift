import type { CSSProperties } from 'react'
import { AlignToolbar } from './AlignToolbar'
import { MONO_FONT } from '../../lib/typography'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
const UNDO_KEYS = IS_MAC ? '⌘Z' : 'Ctrl+Z'
const REDO_KEYS = IS_MAC ? '⇧⌘Z' : 'Ctrl+Shift+Z'

export interface CanvasToolbarProps {
  pageId: string
  selectedWidgetIds: string[]
  screenWidth: number
  screenHeight: number
  overflowingCount: number
  overflowingNames?: readonly string[]
  canUndo: boolean
  undoLabel?: string | undefined
  redoLabel?: string | undefined
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onOpenShortcuts: () => void
  revLimiting: boolean
  onStartRevLimiter: () => void
}

export const CanvasToolbar = ({
  pageId,
  selectedWidgetIds,
  screenWidth,
  screenHeight,
  overflowingCount,
  overflowingNames,
  canUndo,
  undoLabel,
  redoLabel,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenShortcuts,
  revLimiting,
  onStartRevLimiter,
}: CanvasToolbarProps) => (
  <div style={toolbarStyle}>
    <div style={groupStyle}>
      <button
        type="button"
        className="shell-nav-item"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoLabel ? `Undo ${undoLabel} (${UNDO_KEYS})` : `Undo (${UNDO_KEYS})`}
        style={wordButtonStyle(canUndo)}
      >
        UNDO
      </button>
      <button
        type="button"
        className="shell-nav-item"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoLabel ? `Redo ${redoLabel} (${REDO_KEYS})` : `Redo (${REDO_KEYS})`}
        style={{ ...wordButtonStyle(canRedo), borderLeft: groupRule }}
      >
        REDO
      </button>
    </div>

    <div style={groupStyle}>
      <button
        type="button"
        className="shell-nav-item"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        title="Zoom out"
        style={squareButtonStyle(zoom > ZOOM_MIN)}
      >
        −
      </button>
      <button type="button" onClick={onZoomReset} title="Reset zoom" style={zoomValueStyle}>
        {Math.round(zoom * 100)} %
      </button>
      <button
        type="button"
        className="shell-nav-item"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        title="Zoom in"
        style={{ ...squareButtonStyle(zoom < ZOOM_MAX), borderLeft: groupRule }}
      >
        +
      </button>
    </div>

    <span style={infoStyle}>
      {screenWidth} × {screenHeight} · 12-col grid · snap on
    </span>

    <span
      style={flagStyle(overflowingCount > 0)}
      title={
        overflowingCount > 0 && overflowingNames !== undefined
          ? `Past the ${String(screenWidth)} × ${String(screenHeight)} grid: ${overflowingNames.join(', ')}`
          : `Layout fits ${String(screenWidth)} × ${String(screenHeight)}`
      }
    >
      <span aria-hidden="true" style={flagDotStyle(overflowingCount > 0)} />
      {overflowingCount > 0
        ? `${String(overflowingCount)} out of bounds`
        : `fits ${String(screenWidth)} × ${String(screenHeight)}`}
    </span>

    {selectedWidgetIds.length >= 2 && (
      <>
        <AlignToolbar
          pageId={pageId}
          widgetIds={selectedWidgetIds}
          canDistribute={selectedWidgetIds.length >= 3}
        />
        <span style={infoStyle}>{String(selectedWidgetIds.length)} selected</span>
      </>
    )}

    <div style={{ flex: 1 }} />

    <button
      type="button"
      className="shell-nav-item"
      onClick={onOpenShortcuts}
      title="Keyboard shortcuts (?)"
      style={squareButtonStyle(true)}
    >
      ?
    </button>

    <button
      type="button"
      className="editor-ghost-accent"
      onClick={onStartRevLimiter}
      disabled={revLimiting}
      title="Simulate rev limiter (5s)"
      style={revLimitStyle(revLimiting)}
    >
      REV LIMIT
    </button>
  </div>
)

const groupRule = '1px solid hsl(var(--brand-neutral-400))'

const toolbarStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const groupStyle: CSSProperties = {
  display: 'flex',
  border: groupRule,
}

const squareButtonStyle = (enabled: boolean): CSSProperties => ({
  width: 28,
  height: 26,
  background: 'none',
  border: 0,
  color: enabled ? 'hsl(var(--brand-text))' : 'hsl(var(--brand-neutral-400))',
  cursor: enabled ? 'pointer' : 'default',
  fontSize: 13,
  lineHeight: 1,
})

const wordButtonStyle = (enabled: boolean): CSSProperties => ({
  height: 26,
  padding: '0 10px',
  background: 'none',
  border: 0,
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.08em',
  color: enabled ? 'hsl(var(--brand-neutral-700))' : 'hsl(var(--brand-neutral-400))',
  cursor: enabled ? 'pointer' : 'default',
})

const zoomValueStyle: CSSProperties = {
  width: 48,
  background: 'none',
  border: 0,
  borderLeft: groupRule,
  fontFamily: MONO_FONT,
  fontSize: 12,
  textAlign: 'center',
  color: 'hsl(var(--brand-text))',
  cursor: 'pointer',
}

const infoStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
}

const flagStyle = (alert: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: alert ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-500))',
  whiteSpace: 'nowrap',
})

const flagDotStyle = (alert: boolean): CSSProperties => ({
  width: 7,
  height: 7,
  background: alert ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-500))',
})

const revLimitStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  background: active ? 'color-mix(in srgb, hsl(var(--brand-accent)) 14%, transparent)' : 'none',
  border: '1px solid hsl(var(--brand-accent))',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'hsl(var(--brand-accent))',
  cursor: active ? 'default' : 'pointer',
})
