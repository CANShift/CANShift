// ConsolePanel.tsx — Bottom console showing device logs and errors

import { useEffect, useRef, useState } from 'react'
import { useLogStore, type LogEntry } from '../../stores/log.store'
import { IconClear } from '../icons/Icon'

const LEVEL_COLOR: Record<string, string> = {
  info: '#888888',
  warn: '#CC8800',
  error: '#CC3333',
  success: '#44CC66',
}

const LEVEL_PREFIX: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR ',
  success: ' OK ',
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function ConsoleLine({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLOR[entry.level] ?? '#888888'
  const prefix = LEVEL_PREFIX[entry.level] ?? '    '

  return (
    <div style={{ display: 'flex', gap: 8, lineHeight: 1.6 }}>
      <span style={{ color: '#3A3A3A', flexShrink: 0 }}>{formatTime(entry.timestamp)}</span>
      <span style={{ color, flexShrink: 0, fontWeight: 600 }}>{prefix}</span>
      <span style={{ color: entry.level === 'error' ? '#DD4444' : '#AAAAAA' }}>
        {entry.message}
      </span>
    </div>
  )
}

export default function ConsolePanel() {
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [seenCount, setSeenCount] = useState(0)

  // Auto-scroll to latest entry when expanded
  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries.length, collapsed])

  // Track unread entries while collapsed
  useEffect(() => {
    if (!collapsed) setSeenCount(entries.length)
  }, [collapsed, entries.length])

  const unread = collapsed ? entries.length - seenCount : 0
  const hasError = collapsed && entries.slice(seenCount).some((e) => e.level === 'error')
  const hasWarn =
    collapsed && !hasError && entries.slice(seenCount).some((e) => e.level === 'warn')
  const badgeColor = hasError ? '#CC3333' : hasWarn ? '#CC8800' : '#555555'

  return (
    <div
      style={{
        height: collapsed ? 25 : 140,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0A',
        borderTop: '1px solid #222222',
        transition: 'height 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 24,
          borderBottom: collapsed ? 'none' : '1px solid #1A1A1A',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => {
          setCollapsed((v) => !v)
        }}
      >
        {/* Left: label + unread badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: '#AAAAAA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Console
          </span>
          {unread > 0 && (
            <span
              style={{
                fontSize: 9,
                background: badgeColor,
                color: '#FFFFFF',
                borderRadius: 3,
                padding: '1px 5px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {unread}
            </span>
          )}
        </div>

        {/* Right: chevron + clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Chevron */}
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              flexShrink: 0,
            }}
          >
            <polyline
              points="2,3 5,7 8,3"
              fill="none"
              stroke="#666666"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Clear button — stop propagation so click doesn't toggle collapse */}
          {!collapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clear()
              }}
              title="Clear console"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: '#3A3A3A',
                cursor: 'pointer',
                fontSize: 10,
                padding: '0 2px',
              }}
            >
              <IconClear size={10} color="#3A3A3A" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 12px',
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        >
          {entries.length === 0 ? (
            <span style={{ color: '#2A2A2A' }}>No output</span>
          ) : (
            entries.map((entry) => <ConsoleLine key={entry.id} entry={entry} />)
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
