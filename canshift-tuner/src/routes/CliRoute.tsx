import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { usbService, KNOWN_OPCODES } from '../transport'
import { CommandForm } from '../components/cli/CommandForm'
import { CliOutput } from '../components/cli/CliOutput'
import type { CliEntry } from '../components/cli/CliOutput'
import { CliOfflineState } from '../components/cli/CliOfflineState'

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
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>CLI</div>
          <div style={subtitleStyle}>
            Issue raw firmware commands. Pick a known opcode or type a hex / decimal value, fill in
            JSON fields, send.
          </div>
        </div>
      </header>

      <div style={bodyStyle}>
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
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  padding: '20px 28px 16px',
  borderBottom: '1px solid hsl(var(--border))',
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
  marginTop: 4,
  maxWidth: 620,
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '18px 28px 24px',
  minHeight: 0,
}

export default CliRoute
