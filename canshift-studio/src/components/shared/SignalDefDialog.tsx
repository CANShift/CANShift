// SignalDefDialog.tsx — Modal for defining a CAN signal from a scanner frame.
//
// Opened when the user clicks "Define" on a byte or byte-pair in ByteInterpreter.
// Pre-fills canFrameId, startByte, byteLength, bigEndian, signed from the click context.
// Shows a live decoded preview using the current frame data.

import { useState, useCallback } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'

// ---------------------------------------------------------------------------
// Partial pre-fill shape from ByteInterpreter
// ---------------------------------------------------------------------------

export interface SignalDefPreFill {
  canFrameId: string // e.g. "0x370"
  startByte: number
  byteLength: 1 | 2 | 4
  bigEndian: boolean
  signed: boolean
  frameData: number[] // Raw frame bytes for live preview
}

interface Props {
  prefill: SignalDefPreFill
  onSave: (signal: SignalDef) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRaw(
  data: number[],
  startByte: number,
  byteLength: 1 | 2 | 4,
  bigEndian: boolean
): number {
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  for (let i = 0; i < byteLength; i++) {
    view.setUint8(i, data[startByte + i] ?? 0)
  }
  if (byteLength === 1) return view.getUint8(0)
  if (byteLength === 2) return bigEndian ? view.getUint16(0, false) : view.getUint16(0, true)
  return bigEndian ? view.getUint32(0, false) : view.getUint32(0, true)
}

function applySignedness(raw: number, byteLength: 1 | 2 | 4, signed: boolean): number {
  if (!signed) return raw
  const bits = byteLength * 8
  const threshold = 1 << (bits - 1)
  return raw >= threshold ? raw - (1 << bits) : raw
}

// ---------------------------------------------------------------------------
// Field styles
// ---------------------------------------------------------------------------

const INPUT: React.CSSProperties = {
  background: '#1A1A1A',
  border: '1px solid #2A2A2A',
  borderRadius: 4,
  color: '#DDDDDD',
  fontSize: 12,
  padding: '4px 8px',
  width: '100%',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  color: '#555',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  marginBottom: 3,
  display: 'block',
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}): React.ReactElement {
  return (
    <input
      style={INPUT}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  )
}

function NumberInput({
  value,
  onChange,
  step,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
}): React.ReactElement {
  return (
    <input
      style={INPUT}
      type="number"
      step={step ?? 'any'}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(n)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignalDefDialog({ prefill, onSave, onClose }: Props): React.ReactElement {
  const [name, setName] = useState('')
  const [canFrameId] = useState(prefill.canFrameId)
  const [startByte, setStartByte] = useState(prefill.startByte)
  const [byteLength, setByteLength] = useState<1 | 2 | 4>(prefill.byteLength)
  const [bigEndian, setBigEndian] = useState(prefill.bigEndian)
  const [signed, setSigned] = useState(prefill.signed)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState(0)
  const [unit, setUnit] = useState('')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(65535)
  const [warningLevel, setWarningLevel] = useState('')
  const [dangerLevel, setDangerLevel] = useState('')
  const [timeoutMs, setTimeoutMs] = useState(500)

  const rawValue = readRaw(prefill.frameData, startByte, byteLength, bigEndian)
  const signedValue = applySignedness(rawValue, byteLength, signed)
  const scaledValue = signedValue * scale + offset

  const handleSave = useCallback(() => {
    if (!name.trim()) return
    const signal: SignalDef = {
      name: name.trim(),
      canFrameId,
      startByte,
      byteLength,
      bigEndian,
      signed,
      scale,
      offset,
      unit,
      min,
      max,
      timeoutMs,
      ...(warningLevel !== '' ? { warningLevel: parseFloat(warningLevel) } : {}),
      ...(dangerLevel !== '' ? { dangerLevel: parseFloat(dangerLevel) } : {}),
    }
    onSave(signal)
  }, [
    name,
    canFrameId,
    startByte,
    byteLength,
    bigEndian,
    signed,
    scale,
    offset,
    unit,
    min,
    max,
    timeoutMs,
    warningLevel,
    dangerLevel,
    onSave,
  ])

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      {/* Dialog */}
      <div
        style={{
          background: '#161616',
          border: '1px solid #2A2A2A',
          borderRadius: 6,
          padding: 20,
          width: 420,
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#DDDDDD',
            borderBottom: '1px solid #222',
            paddingBottom: 10,
          }}
        >
          Define signal
        </div>

        <Field label="Signal name">
          <TextInput value={name} onChange={setName} placeholder="e.g. rpm" />
        </Field>

        {/* Read-only frame info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Frame ID">
            <div style={{ ...INPUT, color: '#FF8888', fontFamily: 'monospace', cursor: 'default' }}>
              {canFrameId}
            </div>
          </Field>
          <Field label="Start byte">
            <NumberInput
              value={startByte}
              onChange={(v) => {
                setStartByte(Math.max(0, Math.floor(v)))
              }}
            />
          </Field>
          <Field label="Byte length">
            <select
              style={{ ...INPUT, cursor: 'pointer' }}
              value={byteLength}
              onChange={(e) => {
                setByteLength(parseInt(e.target.value) as 1 | 2 | 4)
              }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Byte order">
            <select
              style={{ ...INPUT, cursor: 'pointer' }}
              value={bigEndian ? 'be' : 'le'}
              onChange={(e) => {
                setBigEndian(e.target.value === 'be')
              }}
            >
              <option value="be">Big-endian</option>
              <option value="le">Little-endian</option>
            </select>
          </Field>
          <Field label="Signed">
            <select
              style={{ ...INPUT, cursor: 'pointer' }}
              value={signed ? 'yes' : 'no'}
              onChange={(e) => {
                setSigned(e.target.value === 'yes')
              }}
            >
              <option value="no">Unsigned</option>
              <option value="yes">Signed</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Scale">
            <NumberInput value={scale} onChange={setScale} step={0.001} />
          </Field>
          <Field label="Offset">
            <NumberInput value={offset} onChange={setOffset} step={0.1} />
          </Field>
          <Field label="Unit">
            <TextInput value={unit} onChange={setUnit} placeholder="rpm, °C…" />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Min">
            <NumberInput value={min} onChange={setMin} />
          </Field>
          <Field label="Max">
            <NumberInput value={max} onChange={setMax} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Warning level">
            <TextInput value={warningLevel} onChange={setWarningLevel} placeholder="optional" />
          </Field>
          <Field label="Danger level">
            <TextInput value={dangerLevel} onChange={setDangerLevel} placeholder="optional" />
          </Field>
          <Field label="Timeout (ms)">
            <NumberInput
              value={timeoutMs}
              onChange={(v) => {
                setTimeoutMs(Math.max(0, Math.floor(v)))
              }}
            />
          </Field>
        </div>

        {/* Live preview */}
        <div
          style={{
            background: '#0C0C0C',
            border: '1px solid #1E1E1E',
            borderRadius: 4,
            padding: '8px 12px',
            fontSize: 11,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              color: '#444',
              textTransform: 'uppercase',
              fontSize: 9,
              letterSpacing: '0.06em',
            }}
          >
            Preview
          </span>
          <span style={{ fontFamily: 'monospace', color: '#888' }}>raw: {rawValue}</span>
          {signed && rawValue !== signedValue && (
            <span style={{ fontFamily: 'monospace', color: '#888' }}>signed: {signedValue}</span>
          )}
          <span style={{ fontFamily: 'monospace', color: '#FFAA44', fontWeight: 700 }}>
            {scaledValue.toFixed(scale < 1 ? 3 : 1)} {unit}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '5px 14px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              border: '1px solid #2A2A2A',
              background: 'transparent',
              color: '#666',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              padding: '5px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              border: 'none',
              background: name.trim() ? '#CC3333' : '#2A2A2A',
              color: name.trim() ? '#FFFFFF' : '#444',
            }}
          >
            Add signal
          </button>
        </div>
      </div>
    </div>
  )
}
