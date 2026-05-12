// ByteInterpreter.tsx — Per-byte breakdown panel for a selected CAN frame.
//
// Shows each byte as hex / decimal / binary / ASCII.
// Highlights bytes that changed since the previous render batch.
// Shows uint16 and int16 BE + LE interpretations for each adjacent pair —
// useful for reverse-engineering CAN-broadcast signals (typically uint16 big-endian).
//
// Clicking a byte → triggers onDefineSignal pre-filled for 1-byte unsigned.
// Clicking "Define" on a 16-bit pair row → pre-fills 2-byte uint16 BE.

import type { CanFrameEntry } from '../../stores/canScanner.store'
import type { SignalDefPreFill } from './SignalDefDialog'

// ---------------------------------------------------------------------------
// Byte-level helpers
// ---------------------------------------------------------------------------

function toBin(n: number): string {
  return n.toString(2).padStart(8, '0')
}

function toHex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0')
}

function toAscii(n: number): string {
  return n >= 0x20 && n <= 0x7e ? String.fromCharCode(n) : '·'
}

function readUint16BE(data: number[], offset: number): number {
  return (((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0)) >>> 0
}

function readUint16LE(data: number[], offset: number): number {
  return (((data[offset + 1] ?? 0) << 8) | (data[offset] ?? 0)) >>> 0
}

function readInt16BE(data: number[], offset: number): number {
  const u = readUint16BE(data, offset)
  return u >= 0x8000 ? u - 0x10000 : u
}

function readInt16LE(data: number[], offset: number): number {
  const u = readUint16LE(data, offset)
  return u >= 0x8000 ? u - 0x10000 : u
}

function readUint32BE(data: number[], offset: number): number {
  return (
    (((data[offset] ?? 0) << 24) |
      ((data[offset + 1] ?? 0) << 16) |
      ((data[offset + 2] ?? 0) << 8) |
      (data[offset + 3] ?? 0)) >>>
    0
  )
}

function readFloat32BE(data: number[], offset: number): number {
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  for (let i = 0; i < 4; i++) view.setUint8(i, data[offset + i] ?? 0)
  return view.getFloat32(0, false)
}

// ---------------------------------------------------------------------------
// Byte cell
// ---------------------------------------------------------------------------

const BYTE_CELL_CHANGED: React.CSSProperties = {
  background: '#1E1000',
  borderBottom: '2px solid #FF8800',
  borderRadius: 3,
}

const BYTE_CELL_NORMAL: React.CSSProperties = {
  background: '#151515',
  borderBottom: '2px solid transparent',
  borderRadius: 3,
}

function ByteCell({
  index,
  value,
  changed,
  onClick,
}: {
  index: number
  value: number
  changed: boolean
  onClick?: (() => void) | undefined
}) {
  return (
    <div
      onClick={onClick}
      title={onClick ? 'Click to define signal' : undefined}
      style={{
        ...(changed ? BYTE_CELL_CHANGED : BYTE_CELL_NORMAL),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 8px',
        minWidth: 52,
        gap: 2,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 9, color: '#444', fontFamily: 'monospace' }}>[{index}]</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: changed ? '#FFAA44' : '#DDDDDD',
          fontFamily: 'monospace',
        }}
      >
        {toHex2(value)}
      </span>
      <span style={{ fontSize: 10, color: '#777', fontFamily: 'monospace' }}>{value}</span>
      <span
        style={{ fontSize: 8, color: '#333', fontFamily: 'monospace', letterSpacing: '0.05em' }}
      >
        {toBin(value)}
      </span>
      <span style={{ fontSize: 9, color: '#555' }}>{toAscii(value)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-byte interpretation table
// ---------------------------------------------------------------------------

interface Interpretation {
  bytes: string
  startByte: number
  uintBE: number
  intBE: number
  uintLE: number
  intLE: number
}

function buildInterpretations(data: number[]): Interpretation[] {
  const pairs: Interpretation[] = []
  for (let i = 0; i + 1 < data.length; i++) {
    pairs.push({
      bytes: `${String(i)}–${String(i + 1)}`,
      startByte: i,
      uintBE: readUint16BE(data, i),
      intBE: readInt16BE(data, i),
      uintLE: readUint16LE(data, i),
      intLE: readInt16LE(data, i),
    })
  }
  return pairs
}

const TH: React.CSSProperties = {
  padding: '4px 10px',
  textAlign: 'right',
  fontSize: 9,
  color: '#444',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '3px 10px',
  textAlign: 'right',
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#AAAAAA',
}

const TD_BYTES: React.CSSProperties = {
  ...TD,
  color: '#FF8888',
  fontWeight: 700,
  textAlign: 'left',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ByteInterpreterProps {
  entry: CanFrameEntry
  frameId: number
  onDefineSignal?: (prefill: SignalDefPreFill) => void
}

function toHexId(id: number): string {
  return `0x${id.toString(16).toUpperCase()}`
}

export default function ByteInterpreter({
  entry,
  frameId,
  onDefineSignal,
}: ByteInterpreterProps): React.ReactElement {
  const { data, prevData } = entry
  const interps = buildInterpretations(data)
  const canFrameId = toHexId(frameId)

  // For DLC=0, show a placeholder
  if (data.length === 0) {
    return (
      <div style={{ padding: '12px 20px', fontSize: 11, color: '#555' }}>No payload (DLC = 0)</div>
    )
  }

  const uint32BE = data.length >= 4 ? readUint32BE(data, 0) : null
  const float32 = data.length >= 4 ? readFloat32BE(data, 0) : null
  const float32Valid = float32 !== null && isFinite(float32)

  return (
    <div
      style={{
        background: '#0C0C0C',
        borderTop: '1px solid #1A1A1A',
        borderBottom: '1px solid #1A1A1A',
        padding: '12px 16px',
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      {/* Byte grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            color: '#444',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          Bytes {onDefineSignal && <span style={{ color: '#333' }}>(click to define)</span>}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {data.map((byte, i) => (
            <ByteCell
              key={i}
              index={i}
              value={byte}
              changed={prevData.length > 0 && prevData[i] !== byte}
              onClick={
                onDefineSignal
                  ? () => {
                      onDefineSignal({
                        canFrameId,
                        startByte: i,
                        byteLength: 1,
                        bigEndian: true,
                        signed: false,
                        frameData: data,
                      })
                    }
                  : undefined
              }
            />
          ))}
        </div>
        {prevData.length > 0 && prevData.some((b, i) => b !== data[i]) && (
          <span style={{ fontSize: 9, color: '#FF8800', opacity: 0.7 }}>
            ● changed since last frame
          </span>
        )}
      </div>

      {/* Multi-byte interpretations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            color: '#444',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          16-bit pairs
        </span>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>Bytes</th>
              <th style={TH}>uint BE</th>
              <th style={TH}>int BE</th>
              <th style={TH}>uint LE</th>
              <th style={TH}>int LE</th>
              {onDefineSignal && <th style={TH}></th>}
            </tr>
          </thead>
          <tbody>
            {interps.map((row) => (
              <tr key={row.bytes} style={{ borderTop: '1px solid #161616' }}>
                <td style={TD_BYTES}>{row.bytes}</td>
                <td style={TD}>{row.uintBE}</td>
                <td style={{ ...TD, color: row.intBE < 0 ? '#FF8888' : '#AAAAAA' }}>{row.intBE}</td>
                <td style={{ ...TD, color: '#777' }}>{row.uintLE}</td>
                <td style={{ ...TD, color: row.intLE < 0 ? '#CC6666' : '#777' }}>{row.intLE}</td>
                {onDefineSignal && (
                  <td style={{ ...TD, paddingRight: 4 }}>
                    <button
                      onClick={() => {
                        onDefineSignal({
                          canFrameId,
                          startByte: row.startByte,
                          byteLength: 2,
                          bigEndian: true,
                          signed: false,
                          frameData: data,
                        })
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 3,
                        fontSize: 9,
                        cursor: 'pointer',
                        border: '1px solid #2A2A2A',
                        background: 'transparent',
                        color: '#555',
                      }}
                    >
                      Define
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 32-bit + float (if DLC ≥ 4) */}
      {uint32BE !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              color: '#444',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            32-bit (bytes 0–3)
          </span>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left' }}>Type</th>
                <th style={TH}>Value</th>
                {onDefineSignal && <th style={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid #161616' }}>
                <td style={TD_BYTES}>uint32 BE</td>
                <td style={TD}>{uint32BE}</td>
                {onDefineSignal && (
                  <td style={{ ...TD, paddingRight: 4 }}>
                    <button
                      onClick={() => {
                        onDefineSignal({
                          canFrameId,
                          startByte: 0,
                          byteLength: 4,
                          bigEndian: true,
                          signed: false,
                          frameData: data,
                        })
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 3,
                        fontSize: 9,
                        cursor: 'pointer',
                        border: '1px solid #2A2A2A',
                        background: 'transparent',
                        color: '#555',
                      }}
                    >
                      Define
                    </button>
                  </td>
                )}
              </tr>
              {float32Valid && (
                <tr style={{ borderTop: '1px solid #161616' }}>
                  <td style={TD_BYTES}>float32 BE</td>
                  <td style={TD}>{float32.toFixed(4)}</td>
                  {onDefineSignal && <td />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
