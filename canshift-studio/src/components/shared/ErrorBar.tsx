// ErrorBar.tsx — Sticky bottom bar displaying active application errors.
//
// Collapsed: shows most recent error code + message, count badge if multiple.
// Expanded: scrollable list of all active errors with optional detail block.
// Each error can be individually dismissed; "Clear all" wipes the list.

import { useState, useCallback } from 'react'
import { useErrorStore } from '../../stores/error.store'
import type { AppError } from '../../stores/error.store'

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
        borderBottom: '1px solid #2A1010',
        padding: '5px 10px 5px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#664444', flexShrink: 0 }}>
          {formatTime(error.timestamp)}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#884444',
            background: '#2A1010',
            border: '1px solid #441818',
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
            color: '#DDAAAA',
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
            color: '#886666',
            background: '#110A0A',
            border: '1px solid #2A1010',
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
  color: '#664444',
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
        background: '#160808',
        borderTop: '1px solid #441818',
        borderLeft: '3px solid #CC3333',
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
              background: '#CC3333',
              color: '#FFFFFF',
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
          <span style={{ color: '#CC3333', fontSize: 13, flexShrink: 0 }}>⚠</span>
        )}

        {/* Latest error code */}
        <span
          style={{
            fontSize: 10,
            color: '#884444',
            background: '#2A1010',
            border: '1px solid #441818',
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
            color: '#DDAAAA',
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
            style={{ ...iconBtn, color: '#553333', fontSize: 11 }}
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
            borderTop: '1px solid #2A1010',
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
