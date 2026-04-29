// ConsolePanel.tsx — Bottom console showing device logs and errors

import { useEffect, useRef } from 'react'
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

  // Auto-scroll to latest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div
      style={{
        height: 140,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0A',
        borderTop: '1px solid #222222',
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
          borderBottom: '1px solid #1A1A1A',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#444444',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Console
        </span>
        <button
          onClick={clear}
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
      </div>

      {/* Log entries */}
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
    </div>
  )
}
