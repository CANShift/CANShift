import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLogStore } from '../stores/log.store'
import type { LogLevel } from '../stores/log.store'

const ALL_LEVELS: LogLevel[] = ['info', 'success', 'warn', 'error', 'debug']
const LEVEL_COLOR: Record<LogLevel, string> = {
  info: 'hsl(var(--text-dim))',
  success: 'hsl(var(--success))',
  warn: 'hsl(var(--accent))',
  error: 'hsl(var(--destructive))',
  debug: 'hsl(var(--text-muted))',
}

const STICK_THRESHOLD_PX = 32

export default function LogsRoute() {
  const entries = useLogStore((s) => s.entries)
  const verbose = useLogStore((s) => s.verbose)
  const setVerbose = useLogStore((s) => s.setVerbose)
  const clear = useLogStore((s) => s.clear)

  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    () => new Set<LogLevel>(['info', 'success', 'warn', 'error']),
  )
  const [autoScroll, setAutoScroll] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const visibleLevels = useMemo(() => {
    const next = new Set(enabledLevels)
    if (!verbose) next.delete('debug')
    return next
  }, [enabledLevels, verbose])

  const filtered = useMemo(
    () => entries.filter((e) => visibleLevels.has(e.level)),
    [entries, visibleLevels],
  )

  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [filtered, autoScroll])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom <= STICK_THRESHOLD_PX
    if (atBottom !== autoScroll) setAutoScroll(atBottom)
  }

  const toggleLevel = (level: LogLevel) => {
    setEnabledLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  const handleCopy = () => {
    const text = filtered.map(formatEntryForCopy).join('\n')
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyState('copied')
        window.setTimeout(() => {
          setCopyState('idle')
        }, 1500)
      })
      .catch(() => {
        setCopyState('failed')
        window.setTimeout(() => {
          setCopyState('idle')
        }, 1500)
      })
  }

  const copyLabel =
    copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy all'

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Logs</div>
          <div style={subtitleStyle}>
            {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'} · {entries.length} total
          </div>
        </div>
        <div style={toolbarStyle}>
          {ALL_LEVELS.map((level) => {
            if (level === 'debug' && !verbose) return null
            const active = visibleLevels.has(level)
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  toggleLevel(level)
                }}
                style={levelPillStyle(active, LEVEL_COLOR[level])}
              >
                {level}
              </button>
            )
          })}
          <label style={verboseLabelStyle}>
            <input
              type="checkbox"
              checked={verbose}
              onChange={(e) => {
                setVerbose(e.target.checked)
              }}
            />
            verbose
          </label>
          <div style={dividerStyle} />
          <button
            type="button"
            onClick={handleCopy}
            disabled={filtered.length === 0}
            style={secondaryButtonStyle(filtered.length === 0)}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={entries.length === 0}
            style={secondaryButtonStyle(entries.length === 0)}
          >
            Clear
          </button>
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} style={streamStyle}>
        {filtered.length === 0 ? (
          <div style={emptyStyle}>
            {entries.length === 0
              ? 'No log entries yet.'
              : 'Every entry is hidden by the current filter.'}
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} style={entryStyle}>
              <span style={timestampStyle}>{formatTimestamp(entry.timestamp)}</span>
              <span style={{ ...levelStyle, color: LEVEL_COLOR[entry.level] }}>
                {entry.level.toUpperCase().padEnd(7)}
              </span>
              {entry.scope && <span style={scopeStyle}>[{entry.scope}]</span>}
              <span style={messageStyle}>{entry.message}</span>
            </div>
          ))
        )}
      </div>

      {!autoScroll && filtered.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true)
          }}
          style={jumpStyle}
        >
          Jump to latest ↓
        </button>
      )}
    </div>
  )
}

const formatTimestamp = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

const formatEntryForCopy = (entry: ReturnType<typeof useLogStore.getState>['entries'][number]): string => {
  const ts = formatTimestamp(entry.timestamp)
  const scope = entry.scope ? `[${entry.scope}] ` : ''
  return `${ts}  ${entry.level.toUpperCase().padEnd(7)}  ${scope}${entry.message}`
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
  position: 'relative',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  padding: '20px 28px 16px',
  borderBottom: '1px solid hsl(var(--border))',
  flexWrap: 'wrap',
}

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.01em',
}

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  marginTop: 2,
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
}

const levelPillStyle = (active: boolean, color: string): CSSProperties => ({
  background: active ? 'hsl(var(--surface))' : 'transparent',
  border: `1px solid ${active ? color : 'hsl(var(--border))'}`,
  color: active ? color : 'hsl(var(--text-muted))',
  borderRadius: 999,
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

const verboseLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginLeft: 4,
  cursor: 'pointer',
}

const dividerStyle: CSSProperties = {
  width: 1,
  height: 18,
  background: 'hsl(var(--border))',
  margin: '0 4px',
}

const secondaryButtonStyle = (disabled: boolean): CSSProperties => ({
  background: disabled ? 'hsl(var(--bg-inset))' : 'hsl(var(--surface))',
  color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const streamStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 28px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
  lineHeight: 1.55,
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  padding: '64px 24px',
  fontFamily: 'system-ui, sans-serif',
}

const entryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '2px 0',
}

const timestampStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
}

const levelStyle: CSSProperties = {
  flexShrink: 0,
  fontWeight: 600,
  letterSpacing: '0.04em',
  whiteSpace: 'pre',
}

const scopeStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  flexShrink: 0,
}

const messageStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  wordBreak: 'break-word',
  flex: 1,
}

const jumpStyle: CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'hsl(var(--surface))',
  color: 'hsl(var(--text))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
}
