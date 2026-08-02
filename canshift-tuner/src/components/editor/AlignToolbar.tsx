import { useCallback, type CSSProperties, type MouseEvent } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'
import type { AlignDirection } from '../../stores/dashboard.store'
import { MONO_FONT } from '../../lib/typography'

const BUTTON_STYLE: CSSProperties = {
  padding: '2px 7px',
  fontSize: 10,
  background: 'hsl(var(--brand-neutral-100))',
  border: '1px solid hsl(var(--brand-neutral-300))',
  color: 'hsl(var(--brand-neutral-600))',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  fontFamily: MONO_FONT,
  lineHeight: 1.2,
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  color: 'hsl(var(--brand-neutral-500))',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  alignSelf: 'center',
}

const DIVIDER_STYLE: CSSProperties = {
  width: 1,
  height: 14,
  background: 'hsl(var(--brand-neutral-300))',
  margin: '0 2px',
}

const handleMouseEnter = (e: MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = 'hsl(var(--brand-neutral-400))'
  e.currentTarget.style.color = 'hsl(var(--brand-neutral-700))'
}
const handleMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = 'hsl(var(--brand-neutral-300))'
  e.currentTarget.style.color = 'hsl(var(--brand-neutral-600))'
}

interface ToolbarButtonProps {
  glyph: string
  title: string
  onClick: () => void
}

const ToolbarButton = ({ glyph, title, onClick }: ToolbarButtonProps) => {
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

export const AlignToolbar = ({ pageId, widgetIds, canDistribute }: AlignToolbarProps) => {
  const alignWidgets = useDashboardStore((s) => s.alignWidgets)
  const distributeWidgets = useDashboardStore((s) => s.distributeWidgets)

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
