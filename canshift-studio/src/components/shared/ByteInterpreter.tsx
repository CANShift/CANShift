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
// Local palette — chrome / dim accent shades not yet promoted to core tokens
// (audit S-H-5, umbrella #1015). Hoisted so a future token promotion is a
// one-line swap per shade. `--accent` (#FF8800) is used directly where the
// match is exact; the rest are MIRROR consts.
// ---------------------------------------------------------------------------
const CELL_CHANGED_BG = '#1E1000' // MIRROR: orange-tinted highlight for a changed byte
const CELL_NORMAL_BG = '#151515' // MIRROR: chrome cell background, darker than --bg (#121212)
const CONTAINER_BG = '#0C0C0C' // MIRROR: deepest chrome — the interpreter panel surface
const CONTAINER_BORDER = '#1A1A1A' // MIRROR: chrome separator (top/bottom of panel)
const ROW_BORDER = '#161616' // MIRROR: per-row separator inside the interpretation tables
const BUTTON_BORDER = '#2A2A2A' // MIRROR: dim chrome border around the "Define" buttons
const CHANGED_HEX_TEXT = '#FFAA44' // MIRROR: lighter accent for a changed byte's hex value
const NORMAL_HEX_TEXT = '#DDDDDD' // MIRROR: near-white for a normal byte's hex value
const TD_TEXT = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
const TD_NEG_INT_BE = '#FF8888' // MIRROR: pinkish-red flag for a negative big-endian int
const TD_NEG_INT_LE = '#CC6666' // MIRROR: dimmer variant for the LE column (less prominent)
const TD_DIM_TEXT = '#777' // MIRROR: dim decimal / LE-uint text
const LABEL_TEXT = '#444' // MIRROR: section-label uppercase chrome
const SUBLABEL_TEXT = '#333' // MIRROR: even dimmer chrome label (binary digits / hint)
const ASCII_TEXT = '#555' // MIRROR: dim ASCII glyph / "No payload" placeholder / Define button label

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
  background: CELL_CHANGED_BG,
  borderBottom: '2px solid hsl(var(--accent))',
  borderRadius: 3,
}

const BYTE_CELL_NORMAL: React.CSSProperties = {
  background: CELL_NORMAL_BG,
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
      <span style={{ fontSize: 9, color: LABEL_TEXT, fontFamily: 'monospace' }}>[{index}]</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: changed ? CHANGED_HEX_TEXT : NORMAL_HEX_TEXT,
          fontFamily: 'monospace',
        }}
      >
        {toHex2(value)}
      </span>
      <span style={{ fontSize: 10, color: TD_DIM_TEXT, fontFamily: 'monospace' }}>{value}</span>
      <span
        style={{
          fontSize: 8,
          color: SUBLABEL_TEXT,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}
      >
        {toBin(value)}
      </span>
      <span style={{ fontSize: 9, color: ASCII_TEXT }}>{toAscii(value)}</span>
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
  color: LABEL_TEXT,
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
  color: TD_TEXT,
}

const TD_BYTES: React.CSSProperties = {
  ...TD,
  color: TD_NEG_INT_BE,
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
      <div style={{ padding: '12px 20px', fontSize: 11, color: ASCII_TEXT }}>
        No payload (DLC = 0)
      </div>
    )
  }

  const uint32BE = data.length >= 4 ? readUint32BE(data, 0) : null
  const float32 = data.length >= 4 ? readFloat32BE(data, 0) : null
  const float32Valid = float32 !== null && isFinite(float32)

  return (
    <div
      style={{
        background: CONTAINER_BG,
        borderTop: `1px solid ${CONTAINER_BORDER}`,
        borderBottom: `1px solid ${CONTAINER_BORDER}`,
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
            color: LABEL_TEXT,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          Bytes {onDefineSignal && <span style={{ color: SUBLABEL_TEXT }}>(click to define)</span>}
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
          <span style={{ fontSize: 9, color: 'hsl(var(--accent))', opacity: 0.7 }}>
            ● changed since last frame
          </span>
        )}
      </div>

      {/* Multi-byte interpretations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            color: LABEL_TEXT,
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
              <tr key={row.bytes} style={{ borderTop: `1px solid ${ROW_BORDER}` }}>
                <td style={TD_BYTES}>{row.bytes}</td>
                <td style={TD}>{row.uintBE}</td>
                <td style={{ ...TD, color: row.intBE < 0 ? TD_NEG_INT_BE : TD_TEXT }}>
                  {row.intBE}
                </td>
                <td style={{ ...TD, color: TD_DIM_TEXT }}>{row.uintLE}</td>
                <td style={{ ...TD, color: row.intLE < 0 ? TD_NEG_INT_LE : TD_DIM_TEXT }}>
                  {row.intLE}
                </td>
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
                        border: `1px solid ${BUTTON_BORDER}`,
                        background: 'transparent',
                        color: ASCII_TEXT,
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
              color: LABEL_TEXT,
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
              <tr style={{ borderTop: `1px solid ${ROW_BORDER}` }}>
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
                        border: `1px solid ${BUTTON_BORDER}`,
                        background: 'transparent',
                        color: ASCII_TEXT,
                      }}
                    >
                      Define
                    </button>
                  </td>
                )}
              </tr>
              {float32Valid && (
                <tr style={{ borderTop: `1px solid ${ROW_BORDER}` }}>
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
