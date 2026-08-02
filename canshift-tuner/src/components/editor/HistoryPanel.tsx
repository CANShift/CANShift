import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'
import { MONO_FONT } from '../../lib/typography'

const HistoryPanel = () => {
  const past = useDashboardStore((s) => s.past)
  const future = useDashboardStore((s) => s.future)
  const jumpTo = useDashboardStore((s) => s.jumpTo)
  const currentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [past.length, future.length])

  if (past.length === 0 && future.length === 0) {
    return (
      <div style={emptyStyle}>
        No history yet — every edit lands here, and clicking an entry jumps the canvas back to that
        state.
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        {past.length + future.length} step{past.length + future.length === 1 ? '' : 's'}
      </div>
      <div style={listStyle}>
        {past.map((entry, i) => {
          const isLatestDone = i === past.length - 1
          return (
            <button
              key={`p${String(i)}`}
              type="button"
              onClick={() => {
                if (!isLatestDone) jumpTo({ kind: 'past', index: i + 1 })
              }}
              style={rowStyle(false, isLatestDone)}
              title={
                isLatestDone ? 'This is the current state' : 'Jump back to just after this action'
              }
            >
              <span style={indexStyle}>{String(i + 1).padStart(2, '0')}</span>
              <span style={labelStyle}>{entry.label}</span>
            </button>
          )
        })}
        <div ref={currentRef} style={currentRowStyle}>
          <span style={currentDotStyle} />
          Current state
        </div>
        {future.map((entry, k) => (
          <button
            key={`f${String(k)}`}
            type="button"
            onClick={() => {
              jumpTo({ kind: 'future', index: k })
            }}
            style={rowStyle(true, false)}
            title="Jump forward to just after this action"
          >
            <span style={indexStyle}>{String(past.length + k + 1).padStart(2, '0')}</span>
            <span style={labelStyle}>{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default HistoryPanel

const panelStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const headerStyle: CSSProperties = {
  padding: '12px 18px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'hsl(var(--brand-neutral-600))',
}

const listStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const rowStyle = (isFuture: boolean, isLatestDone: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  width: '100%',
  padding: '8px 18px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  textAlign: 'left',
  cursor: isLatestDone ? 'default' : 'pointer',
  color: isFuture ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-neutral-700))',
  fontFamily: 'inherit',
})

const currentRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 18px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  boxShadow: 'inset 3px 0 0 hsl(var(--brand-accent))',
  background: 'hsl(var(--brand-neutral-100))',
  fontWeight: 800,
  fontSize: 12,
  color: 'hsl(var(--brand-text))',
}

const currentDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  flexShrink: 0,
  background: 'hsl(var(--brand-accent))',
}

const indexStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-500))',
  flexShrink: 0,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const emptyStyle: CSSProperties = {
  flex: 1,
  padding: '24px 18px',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'hsl(var(--brand-neutral-500))',
}
