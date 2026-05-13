// RealDashImportDialog.tsx — Select a bundled RealDash CAN XML profile.
//
// All ECU descriptors are bundled at build time via import.meta.glob — no file
// picker, no IPC, no runtime fetch. Select → preview → confirm replaces the
// current signal map.

import { useState } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { parseRealDashXML } from '@tmbk/canshift-core'
import { REALDASH_CATALOG } from '../../data/realdash-catalog'

interface Props {
  onImport: (signals: SignalDef[]) => void
  onClose: () => void
}

interface Preview {
  signals: SignalDef[]
  warnings: string[]
  profileName: string
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
}

const panel: React.CSSProperties = {
  background: '#161616',
  border: '1px solid #333333',
  borderRadius: 6,
  padding: '20px 24px',
  width: 560,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const btnBase: React.CSSProperties = {
  borderRadius: 4,
  fontSize: 12,
  padding: '6px 14px',
  cursor: 'pointer',
  fontWeight: 600,
}

// Group profiles by manufacturer for the grouped select.
const GROUPED = REALDASH_CATALOG.reduce<Record<string, typeof REALDASH_CATALOG>>(
  (acc, p) => {
    const list = (acc[p.manufacturer] ??= [])
    list.push(p)
    return acc
  },
  {}
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RealDashImportDialog({ onImport, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [preview, setPreview] = useState<Preview | null>(null)

  function handleSelect(id: string) {
    setSelectedId(id)
    if (!id) {
      setPreview(null)
      return
    }
    const profile = REALDASH_CATALOG.find((p) => p.id === id)
    if (!profile) return
    const { signals, warnings } = parseRealDashXML(profile.xml)
    setPreview({ signals, warnings, profileName: `${profile.manufacturer} — ${profile.name}` })
  }

  function confirmImport() {
    if (!preview) return
    onImport(preview.signals)
    onClose()
  }

  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={panel}>
        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#CCCCCC' }}>
          Load RealDash ECU profile
        </div>

        {/* ECU selector */}
        <select
          value={selectedId}
          onChange={(e) => {
            handleSelect(e.target.value)
          }}
          style={{
            background: '#111111',
            border: '1px solid #2A2A2A',
            borderRadius: 4,
            color: selectedId ? '#CCCCCC' : '#555555',
            fontSize: 12,
            padding: '6px 10px',
            cursor: 'pointer',
            width: '100%',
          }}
          aria-label="Select RealDash ECU profile"
        >
          <option value="">— select ECU —</option>
          {Object.entries(GROUPED).map(([mfr, profiles]) => (
            <optgroup key={mfr} label={mfr}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Preview */}
        {preview && (
          <>
            <div style={{ fontSize: 12, color: '#888888', lineHeight: 1.6 }}>
              <strong style={{ color: '#CCCCCC' }}>{preview.signals.length} signals</strong> across{' '}
              <strong style={{ color: '#CCCCCC' }}>
                {new Set(preview.signals.map((s) => s.canFrameId)).size} frames
              </strong>
              .
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div
                style={{
                  background: '#1a1200',
                  border: '1px solid #332200',
                  borderRadius: 4,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: '#BB8800',
                  maxHeight: 80,
                  overflow: 'auto',
                }}
              >
                {preview.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            {/* Signal preview table */}
            <div
              style={{
                maxHeight: 280,
                overflow: 'auto',
                borderRadius: 4,
                border: '1px solid #222',
              }}
            >
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['name', 'frameId', 'byte', 'len', 'scale', 'offset', 'unit'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '4px 8px',
                          textAlign: 'left',
                          color: '#666',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: '#111',
                          position: 'sticky',
                          top: 0,
                          borderBottom: '1px solid #222',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.signals.slice(0, 60).map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '3px 8px', fontFamily: 'monospace', color: '#CCC' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '3px 8px', fontFamily: 'monospace', color: '#888' }}>
                        {s.canFrameId}
                      </td>
                      <td style={{ padding: '3px 8px', color: '#888' }}>{s.startByte}</td>
                      <td style={{ padding: '3px 8px', color: '#888' }}>{s.byteLength}</td>
                      <td style={{ padding: '3px 8px', color: '#888' }}>{s.scale}</td>
                      <td style={{ padding: '3px 8px', color: '#888' }}>{s.offset}</td>
                      <td style={{ padding: '3px 8px', color: '#888' }}>{s.unit}</td>
                    </tr>
                  ))}
                  {preview.signals.length > 60 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ padding: '4px 8px', color: '#555', fontStyle: 'italic' }}
                      >
                        … and {preview.signals.length - 60} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              ...btnBase,
              background: 'transparent',
              border: '1px solid #333333',
              color: '#888888',
              fontWeight: 400,
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirmImport}
            disabled={!preview}
            style={{
              ...btnBase,
              background: preview ? '#CC3333' : '#3a1111',
              border: 'none',
              color: preview ? '#FFFFFF' : '#5a2222',
              cursor: preview ? 'pointer' : 'not-allowed',
            }}
          >
            {preview ? `Load ${String(preview.signals.length)} signals` : 'Load'}
          </button>
        </div>
      </div>
    </div>
  )
}
