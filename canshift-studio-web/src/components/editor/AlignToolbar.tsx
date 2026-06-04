// AlignToolbar.tsx — Alignment + distribution controls for the Canvas
// multi-select. Pure presentation: dispatches store actions, no local state.

import { useCallback, type CSSProperties, type MouseEvent } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'
import type { AlignDirection } from '../../stores/dashboard.store'

const BUTTON_STYLE: CSSProperties = {
  padding: '2px 7px',
  fontSize: 10,
  background: '#1A1A1A',
  border: '1px solid #2A2A2A',
  borderRadius: 3,
  color: '#888888',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  fontFamily: 'monospace',
  lineHeight: 1.2,
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  color: '#555555',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  alignSelf: 'center',
}

const DIVIDER_STYLE: CSSProperties = {
  width: 1,
  height: 14,
  background: '#2A2A2A',
  margin: '0 2px',
}

// Hover state lives on the DOM element so it can't trigger React re-renders.
function handleMouseEnter(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = '#555555'
  e.currentTarget.style.color = '#CCCCCC'
}
function handleMouseLeave(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = '#2A2A2A'
  e.currentTarget.style.color = '#888888'
}

interface ToolbarButtonProps {
  glyph: string
  title: string
  onClick: () => void
}

function ToolbarButton({ glyph, title, onClick }: ToolbarButtonProps) {
  return (
    <button
      style={BUTTON_STYLE}
      title={title}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {glyph}
    </button>
  )
}

interface AlignSpec {
  dir: AlignDirection
  glyph: string
  title: string
}

const ALIGN_SPECS: readonly AlignSpec[] = [
  { dir: 'left', glyph: '←', title: 'Align left edges' },
  { dir: 'center-h', glyph: '↔', title: 'Center horizontally' },
  { dir: 'right', glyph: '→', title: 'Align right edges' },
  { dir: 'top', glyph: '↑', title: 'Align top edges' },
  { dir: 'center-v', glyph: '↕', title: 'Center vertically' },
  { dir: 'bottom', glyph: '↓', title: 'Align bottom edges' },
]

interface DistributeSpec {
  axis: 'h' | 'v'
  glyph: string
  title: string
}

const DISTRIBUTE_SPECS: readonly DistributeSpec[] = [
  { axis: 'h', glyph: '⇔', title: 'Distribute horizontally' },
  { axis: 'v', glyph: '⇕', title: 'Distribute vertically' },
]

export interface AlignToolbarProps {
  pageId: string
  widgetIds: string[]
  canDistribute: boolean
}

export function AlignToolbar({ pageId, widgetIds, canDistribute }: AlignToolbarProps) {
  const alignWidgets = useDashboardStore((s) => s.alignWidgets)
  const distributeWidgets = useDashboardStore((s) => s.distributeWidgets)

  // Memoised dispatchers so `ToolbarButton` (props-only memo target via
  // stable handlers) doesn't see a fresh closure on every parent render
  // (audit follow-up to #1207).
  const handleAlign = useCallback(
    (dir: AlignDirection) => {
      alignWidgets(pageId, widgetIds, dir)
    },
    [alignWidgets, pageId, widgetIds]
  )
  const handleDistribute = useCallback(
    (axis: 'h' | 'v') => {
      distributeWidgets(pageId, widgetIds, axis)
    },
    [distributeWidgets, pageId, widgetIds]
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={LABEL_STYLE}>Align</span>
      {ALIGN_SPECS.map((spec) => (
        <ToolbarButton
          key={spec.dir}
          glyph={spec.glyph}
          title={spec.title}
          onClick={() => {
            handleAlign(spec.dir)
          }}
        />
      ))}
      {canDistribute && (
        <>
          <div style={DIVIDER_STYLE} />
          <span style={LABEL_STYLE}>Dist</span>
          {DISTRIBUTE_SPECS.map((spec) => (
            <ToolbarButton
              key={spec.axis}
              glyph={spec.glyph}
              title={spec.title}
              onClick={() => {
                handleDistribute(spec.axis)
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
