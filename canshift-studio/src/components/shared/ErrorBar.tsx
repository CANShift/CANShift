// ErrorBar.tsx — Sticky bottom bar displaying active application errors.
//
// Collapsed: shows most recent error code + message, count badge if multiple.
// Expanded: scrollable list of all active errors with optional detail block.
// Each error can be individually dismissed; "Clear all" wipes the list.

import { useState, useCallback } from 'react'
import { useErrorStore } from '../../stores/error.store'
import type { AppError } from '../../stores/error.store'

// Custom error palette — these shades do not yet map to core design tokens
// (`--destructive` / `--danger` are pure #FF0000 and are too bright for the
// sustained "error chrome" look). Hoisted so the planned token promotion
// (audit S-H-5, umbrella #1015) is a one-line swap per shade.
const ERR_BAR_BG = '#160808' // MIRROR: deep red bar background
const ERR_ACCENT = '#CC3333' // MIRROR: accent strip + count badge
const ERR_BORDER = '#441818' // MIRROR: badge border
const ERR_BORDER_DIM = '#2A1010' // MIRROR: row separator / badge bg
const ERR_DETAIL_BG = '#110A0A' // MIRROR: detail block background
const ERR_BADGE_TEXT = '#884444' // MIRROR
const ERR_TIME_TEXT = '#664444' // MIRROR
const ERR_DETAIL_TEXT = '#886666' // MIRROR
const ERR_MSG_TEXT = '#DDAAAA' // MIRROR
const ERR_CLEAR_TEXT = '#553333' // MIRROR

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function sourceLabel(source: AppError['source']): string {
  switch (source) {
    case 'usb':
      return 'USB'
    case 'can':
      return 'CAN'
    case 'config':
      return 'Config'
    case 'system':
      return 'System'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorRow({ error, onDismiss }: { error: AppError; onDismiss: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <div
      style={{
        borderBottom: `1px solid ${ERR_BORDER_DIM}`,
        padding: '5px 10px 5px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: ERR_TIME_TEXT, flexShrink: 0 }}>
          {formatTime(error.timestamp)}
        </span>
        <span
          style={{
            fontSize: 10,
            color: ERR_BADGE_TEXT,
            background: ERR_BORDER_DIM,
            border: `1px solid ${ERR_BORDER}`,
            borderRadius: 3,
            padding: '1px 5px',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {sourceLabel(error.source)}:{error.code}
        </span>
        <span
          style={{
            fontSize: 11,
            color: ERR_MSG_TEXT,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {error.message}
        </span>
        {error.detail && (
          <button
            onClick={() => {
              setDetailOpen((v) => !v)
            }}
            title={detailOpen ? 'Hide detail' : 'Show detail'}
            style={iconBtn}
          >
            {detailOpen ? '▴' : '▾'}
          </button>
        )}
        <button onClick={onDismiss} title="Dismiss" style={iconBtn}>
          ×
        </button>
      </div>

      {detailOpen && error.detail && (
        <pre
          style={{
            margin: '4px 0 0 0',
            padding: '6px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: ERR_DETAIL_TEXT,
            background: ERR_DETAIL_BG,
            border: `1px solid ${ERR_BORDER_DIM}`,
            borderRadius: 3,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {error.detail}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: ERR_TIME_TEXT,
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
  padding: '0 2px',
  flexShrink: 0,
}

export default function ErrorBar() {
  const errors = useErrorStore((s) => s.errors)
  const dismiss = useErrorStore((s) => s.dismiss)
  const clear = useErrorStore((s) => s.clear)
  const [expanded, setExpanded] = useState(false)

  const toggle = useCallback(() => {
    setExpanded((v) => !v)
  }, [])

  const latest = errors[0]
  if (!latest) return null

  return (
    <div
      style={{
        background: ERR_BAR_BG,
        borderTop: `1px solid ${ERR_BORDER}`,
        borderLeft: `3px solid ${ERR_ACCENT}`,
        flexShrink: 0,
      }}
    >
      {/* Collapsed header — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 8px 0 10px',
          cursor: 'pointer',
        }}
        onClick={toggle}
      >
        {/* Count badge */}
        {errors.length > 1 ? (
          <span
            style={{
              background: ERR_ACCENT,
              color: 'hsl(var(--text))',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 10,
              padding: '1px 6px',
              flexShrink: 0,
            }}
          >
            {errors.length}
          </span>
        ) : (
          <span style={{ color: ERR_ACCENT, fontSize: 13, flexShrink: 0 }}>⚠</span>
        )}

        {/* Latest error code */}
        <span
          style={{
            fontSize: 10,
            color: ERR_BADGE_TEXT,
            background: ERR_BORDER_DIM,
            border: `1px solid ${ERR_BORDER}`,
            borderRadius: 3,
            padding: '1px 5px',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {sourceLabel(latest.source)}:{latest.code}
        </span>

        {/* Latest error message */}
        <span
          style={{
            fontSize: 11,
            color: ERR_MSG_TEXT,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {latest.message}
        </span>

        {/* Controls — stop propagation so clicks don't toggle expand */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          title={expanded ? 'Collapse' : 'Expand'}
          style={iconBtn}
        >
          {expanded ? '▴' : '▾'}
        </button>

        {errors.length > 1 ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              clear()
              setExpanded(false)
            }}
            title="Clear all errors"
            style={{ ...iconBtn, color: ERR_CLEAR_TEXT, fontSize: 11 }}
          >
            Clear all
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismiss(latest.id)
              setExpanded(false)
            }}
            title="Dismiss"
            style={{ ...iconBtn, fontSize: 15 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Expanded list */}
      {expanded && (
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            borderTop: `1px solid ${ERR_BORDER_DIM}`,
          }}
        >
          {errors.map((err) => (
            <ErrorRow
              key={err.id}
              error={err}
              onDismiss={() => {
                dismiss(err.id)
                if (errors.length === 1) setExpanded(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
