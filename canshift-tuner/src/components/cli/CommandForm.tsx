import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { KNOWN_OPCODES } from '../../transport'

export interface CommandFormProps {
  disabled: boolean
  busy: boolean
  onSubmit: (cmd: number, fields: Record<string, unknown>) => void
  onHistoryUp: () => string | null
  onHistoryDown: () => string | null
}

export const CommandForm = ({
  disabled,
  busy,
  onSubmit,
  onHistoryUp,
  onHistoryDown,
}: CommandFormProps) => {
  const [opcodeInput, setOpcodeInput] = useState(formatHex(KNOWN_OPCODES[0]?.id ?? 0))
  const [fieldsInput, setFieldsInput] = useState('{}')
  const [parseError, setParseError] = useState<string | null>(null)
  const fieldsRef = useRef<HTMLTextAreaElement | null>(null)

  const parsedOpcode = useMemo(() => parseOpcode(opcodeInput), [opcodeInput])
  const matched = useMemo(() => KNOWN_OPCODES.find((o) => o.id === parsedOpcode), [parsedOpcode])

  useEffect(() => {
    setParseError(null)
  }, [fieldsInput])

  const handleSubmit = () => {
    if (parsedOpcode === null) {
      setParseError('Opcode must be a hex like 0x05 or a decimal 5')
      return
    }
    const trimmed = fieldsInput.trim()
    if (trimmed.length === 0) {
      onSubmit(parsedOpcode, {})
      return
    }
    let fields: unknown
    try {
      fields = JSON.parse(trimmed)
    } catch (err) {
      setParseError(`JSON parse error — ${err instanceof Error ? err.message : 'invalid'}`)
      return
    }
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
      setParseError('Fields must be a JSON object (got array or primitive)')
      return
    }
    onSubmit(parsedOpcode, fields as Record<string, unknown>)
  }

  const handleFieldsKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }
    if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const prev = onHistoryUp()
      if (prev !== null) setFieldsInput(prev)
      return
    }
    if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const next = onHistoryDown()
      setFieldsInput(next ?? '{}')
    }
  }

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <label style={labelStyle} htmlFor="cli-opcode">
          Opcode
        </label>
        <input
          id="cli-opcode"
          type="text"
          value={opcodeInput}
          onChange={(e) => {
            setOpcodeInput(e.target.value)
          }}
          placeholder="0x05 or 5 or CMD_SCREEN_SETTINGS"
          style={opcodeInputStyle}
        />
        <select
          aria-label="Pick a known opcode"
          value={parsedOpcode !== null ? String(parsedOpcode) : ''}
          onChange={(e) => {
            const id = Number(e.target.value)
            if (Number.isFinite(id)) setOpcodeInput(formatHex(id))
          }}
          style={opcodeSelectStyle}
        >
          <option value="">Pick known…</option>
          {KNOWN_OPCODES.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {formatHex(o.id)} · {o.name}
            </option>
          ))}
        </select>
      </div>
      {matched && <div style={descriptionStyle}>{matched.description}</div>}

      <div style={rowStyle}>
        <label style={labelStyle} htmlFor="cli-fields">
          Fields
        </label>
      </div>
      <textarea
        ref={fieldsRef}
        id="cli-fields"
        value={fieldsInput}
        onChange={(e) => {
          setFieldsInput(e.target.value)
        }}
        onKeyDown={handleFieldsKey}
        rows={4}
        style={textareaStyle}
        spellCheck={false}
      />
      {parseError && <div style={errorStyle}>{parseError}</div>}

      <div style={submitRowStyle}>
        <Button size="sm" disabled={disabled || busy} onClick={handleSubmit}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
        <span style={hintStyle}>⌘/Ctrl ↩ to send · ⌘/Ctrl ↑↓ for history</span>
      </div>
    </div>
  )
}

const parseOpcode = (input: string): number | null => {
  const trimmed = input.trim()
  if (!trimmed) return null
  const known = KNOWN_OPCODES.find((o) => o.name.toLowerCase() === trimmed.toLowerCase())
  if (known) return known.id
  if (trimmed.toLowerCase().startsWith('0x')) {
    const n = parseInt(trimmed.slice(2), 16)
    return Number.isFinite(n) && n >= 0 && n <= 0xff ? n : null
  }
  const dec = Number(trimmed)
  if (Number.isFinite(dec) && Number.isInteger(dec) && dec >= 0 && dec <= 0xff) return dec
  return null
}

const formatHex = (id: number): string => {
  return `0x${id.toString(16).toUpperCase().padStart(2, '0')}`
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  minWidth: 60,
}

const opcodeInputStyle: CSSProperties = {
  flex: 1,
  background: 'hsl(var(--bg))',
  border: '1px solid hsl(var(--border))',
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text))',
  outline: 'none',
}

const opcodeSelectStyle: CSSProperties = {
  background: 'hsl(var(--bg))',
  border: '1px solid hsl(var(--border))',
  padding: '6px 8px',
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
}

const descriptionStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  paddingLeft: 68,
}

const textareaStyle: CSSProperties = {
  width: '100%',
  background: 'hsl(var(--bg))',
  border: '1px solid hsl(var(--border))',
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text))',
  outline: 'none',
  resize: 'vertical',
}

const errorStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--destructive))',
  background: 'hsl(var(--destructive) / 0.1)',
  border: '1px solid hsl(var(--destructive))',
  padding: '6px 8px',
}

const submitRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const hintStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}
