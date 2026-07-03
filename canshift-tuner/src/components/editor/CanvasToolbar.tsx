import { Button } from '@/components/ui/button'
import { AlignToolbar } from './AlignToolbar'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

export interface CanvasToolbarProps {
  pageId: string
  selectedWidgetIds: string[]
  screenWidth: number
  screenHeight: number
  overflowingCount: number
  canUndo: boolean
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
  canUndo,
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
}: CanvasToolbarProps) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderBottom: '1px solid hsl(var(--surface))',
        gap: 8,
        flexShrink: 0,
        minHeight: 28,
      }}
    >
      <Button
        variant="outline"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="h-auto disabled:opacity-100"
        style={{
          padding: '2px 8px',
          fontSize: 12,
          background: 'transparent',
          border: '1px solid hsl(var(--border))',
          borderRadius: 3,
          color: canUndo ? '#AAAAAA' : '#444444',
          cursor: canUndo ? 'pointer' : 'default',
        }}
      >
        ↶
      </Button>
      <Button
        variant="outline"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (⇧⌘Z)"
        className="h-auto disabled:opacity-100"
        style={{
          padding: '2px 8px',
          fontSize: 12,
          background: 'transparent',
          border: '1px solid hsl(var(--border))',
          borderRadius: 3,
          color: canRedo ? '#AAAAAA' : '#444444',
          cursor: canRedo ? 'pointer' : 'default',
        }}
      >
        ↷
      </Button>

      {selectedWidgetIds.length >= 2 ? (
        <AlignToolbar
          pageId={pageId}
          widgetIds={selectedWidgetIds}
          canDistribute={selectedWidgetIds.length >= 3}
        />
      ) : (
        <span style={{ fontSize: 9, color: 'hsl(var(--border))', letterSpacing: '0.05em' }}>
          PREVIEW — {screenWidth} × {screenHeight}
        </span>
      )}

      {overflowingCount > 0 && (
        <span
          title="One or more widgets extend past the target screen bounds. Resize or move them to fit."
          style={{
            padding: '2px 6px',
            fontSize: 9,
            fontWeight: 600,
            background: '#2A1A00',
            border: '1px solid #663300',
            borderRadius: 3,
            color: '#FFAA44',
            letterSpacing: '0.05em',
          }}
        >
          ⚠ {String(overflowingCount)} OFF-CANVAS
        </span>
      )}

      <div style={{ flex: 1 }} />

      {selectedWidgetIds.length >= 2 && (
        <span style={{ fontSize: 9, color: '#666666', letterSpacing: '0.04em' }}>
          {String(selectedWidgetIds.length)} selected
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outline"
          onClick={onZoomOut}
          disabled={zoom <= ZOOM_MIN}
          title="Zoom out"
          className="h-auto disabled:opacity-100"
          style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
        >
          −
        </Button>
        <button
          onClick={onZoomReset}
          title="Reset zoom"
          style={{
            minWidth: 44,
            padding: '2px 4px',
            fontSize: 10,
            fontVariantNumeric: 'tabular-nums',
            background: 'transparent',
            border: 'none',
            color: 'hsl(var(--text-muted))',
            cursor: 'pointer',
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button
          variant="outline"
          onClick={onZoomIn}
          disabled={zoom >= ZOOM_MAX}
          title="Zoom in"
          className="h-auto disabled:opacity-100"
          style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
        >
          +
        </Button>
      </div>

      <Button
        variant="outline"
        onClick={onOpenShortcuts}
        title="Keyboard shortcuts (?)"
        className="h-auto"
        style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
      >
        ?
      </Button>

      <Button
        variant="outline"
        onClick={onStartRevLimiter}
        disabled={revLimiting}
        title="Simulate rev limiter (5s)"
        className="h-auto disabled:opacity-100"
        style={{
          padding: '3px 10px',
          fontSize: 10,
          fontWeight: 600,
          background: revLimiting ? '#3A0000' : '#1E0A0A',
          border: `1px solid ${revLimiting ? '#CC0000' : '#663333'}`,
          borderRadius: 3,
          color: revLimiting ? '#FF4444' : '#CC5555',
          cursor: revLimiting ? 'default' : 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        ⚡ Rev Limit
      </Button>
    </div>
  )
}
