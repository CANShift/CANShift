import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { usbService, KNOWN_OPCODES } from '../transport'
import { CommandForm } from '../components/cli/CommandForm'
import { CliOutput } from '../components/cli/CliOutput'
import type { CliEntry } from '../components/cli/CliOutput'
import { CliOfflineState } from '../components/cli/CliOfflineState'
import { RouteHeader } from '../components/shell/RouteHeader'
import { MONO_FONT } from '../lib/typography'

const HISTORY_CAP = 50
const ENTRIES_CAP = 200

const CliRoute = () => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const [entries, setEntries] = useState<CliEntry[]>([])
  const [busy, setBusy] = useState(false)
  const historyRef = useRef<string[]>([])
  const historyCursorRef = useRef<number>(-1)
  const nextIdRef = useRef(1)

  const canControl = connected && !simulationMode

  const push = useCallback((entry: Omit<CliEntry, 'id' | 'timestamp'>) => {
    setEntries((prev) => {
      const next = prev.concat({
        ...entry,
        id: nextIdRef.current++,
        timestamp: new Date(),
      })
      if (next.length > ENTRIES_CAP) next.splice(0, next.length - ENTRIES_CAP)
      return next
    })
  }, [])

  const onSubmit = useCallback(
    (cmd: number, fields: Record<string, unknown>) => {
      const knownName = KNOWN_OPCODES.find((o) => o.id === cmd)?.name
      const opcodeLabel = `${formatHex(cmd)}${knownName ? ` (${knownName})` : ''}`
      const fieldsJson = JSON.stringify(fields)
      if (fieldsJson !== '{}') {
        historyRef.current = [fieldsJson, ...historyRef.current.filter((h) => h !== fieldsJson)]
        if (historyRef.current.length > HISTORY_CAP) historyRef.current.length = HISTORY_CAP
      }
      historyCursorRef.current = -1
      push({ kind: 'request', label: opcodeLabel, payload: fields })
      setBusy(true)
      void usbService.sendRaw(cmd, fields).then((result) => {
        if (result.kind === 'ok') {
          push({ kind: 'ok', label: opcodeLabel, payload: result.data })
        } else {
          push({ kind: 'error', label: `${opcodeLabel} — ${result.error}`, payload: result.data })
        }
        setBusy(false)
      })
    },
    [push]
  )

  const onHistoryUp = useCallback((): string | null => {
    if (historyRef.current.length === 0) return null
    const nextCursor = Math.min(historyCursorRef.current + 1, historyRef.current.length - 1)
    historyCursorRef.current = nextCursor
    return historyRef.current[nextCursor] ?? null
  }, [])

  const onHistoryDown = useCallback((): string | null => {
    if (historyCursorRef.current <= 0) {
      historyCursorRef.current = -1
      return null
    }
    historyCursorRef.current -= 1
    return historyRef.current[historyCursorRef.current] ?? null
  }, [])

  const onClear = useCallback(() => {
    setEntries([])
  }, [])

  return (
    <div style={containerStyle}>
      <RouteHeader title="CLI" subtitle="raw firmware opcodes over USB" />

      <div style={bodyStyle}>
        <div style={terminalColumnStyle}>
          {canControl ? (
            <>
              <CommandForm
                disabled={false}
                busy={busy}
                onSubmit={onSubmit}
                onHistoryUp={onHistoryUp}
                onHistoryDown={onHistoryDown}
              />
              <CliOutput entries={entries} onClear={onClear} />
            </>
          ) : (
            <CliOfflineState />
          )}
        </div>

        <aside style={commandPanelStyle}>
          <div style={commandHeaderStyle}>COMMANDS</div>
          {KNOWN_OPCODES.map((op) => (
            <div key={op.id} style={commandRowStyle} title={op.description}>
              <span style={{ color: 'hsl(var(--brand-accent))' }}>{formatHex(op.id)}</span>{' '}
              {op.name.replace(/^CMD_/, '').toLowerCase()}
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

const formatHex = (id: number): string => {
  return `0x${id.toString(16).toUpperCase().padStart(2, '0')}`
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
}

const terminalColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '18px 20px',
  background: '#0B0A0A',
  overflow: 'hidden',
}

const commandPanelStyle: CSSProperties = {
  width: 290,
  flexShrink: 0,
  borderLeft: '2px solid var(--brand-divider)',
  background: 'hsl(var(--brand-neutral-100))',
  overflowY: 'auto',
}

const commandHeaderStyle: CSSProperties = {
  padding: '14px 18px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const commandRowStyle: CSSProperties = {
  padding: '11px 18px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  fontFamily: MONO_FONT,
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-700))',
  cursor: 'help',
}

export default CliRoute
