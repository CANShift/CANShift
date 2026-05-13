// src/routes/SignalRoute.tsx — CAN signal mapping editor

import { useRef, useCallback, useState } from 'react'
import type { SignalDef, SignalConfig } from '@tmbk/canshift-core'
import { CURRENT_SCHEMA_VERSION, ECU_PROFILES } from '@tmbk/canshift-core'
import { useSignalStore } from '../stores/signal.store'
import { signalIpc } from '../services/ipc.service'
import { Checkbox } from '@/components/ui/checkbox'
import { RealDashImportDialog } from '../components/shared/RealDashImportDialog'

const inputStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #333333',
  color: '#CCCCCC',
  fontSize: 12,
  padding: '2px 4px',
  borderRadius: 3,
  width: '100%',
  boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: 10,
  color: '#AAAAAA',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontWeight: 600,
  borderBottom: '1px solid #222222',
  whiteSpace: 'nowrap',
  position: 'sticky' as const,
  top: 0,
  background: '#111111',
  zIndex: 1,
}

const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #1a1a1a',
  verticalAlign: 'middle',
}

const DEFAULT_BYTE_LENGTH: 1 | 2 | 4 = 1

function buildDefaultSignal(index: number): SignalDef {
  return {
    name: `new_signal_${String(index)}`,
    canFrameId: '0x000',
    startByte: 0,
    byteLength: DEFAULT_BYTE_LENGTH,
    bigEndian: true,
    signed: false,
    scale: 1.0,
    offset: 0.0,
    unit: '',
    min: 0,
    max: 100,
    timeoutMs: 500,
  }
}

function parseByteLength(value: string): 1 | 2 | 4 {
  const n = parseInt(value, 10)
  if (n === 2) return 2
  if (n === 4) return 4
  return 1
}

function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _omitted, ...rest } = obj
  return rest
}

export default function SignalRoute() {
  const signals = useSignalStore((s) => s.signals)
  const activeProfileId = useSignalStore((s) => s.activeProfileId)
  const setSignals = useSignalStore((s) => s.setSignals)
  const loadProfile = useSignalStore((s) => s.loadProfile)
  const tableEndRef = useRef<HTMLDivElement>(null)
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const activeProfile = ECU_PROFILES.find((p) => p.id === activeProfileId)

  const handleExport = useCallback(async () => {
    if (signals.length === 0) return
    const config: SignalConfig = {
      version: CURRENT_SCHEMA_VERSION,
      protocol: activeProfile?.protocol ?? 'generic',
      canSpeedKbps: 500,
      signals,
    }
    await signalIpc.export(config)
  }, [signals, activeProfile])

  function handleProfileChange(profileId: string): void {
    if (profileId === activeProfileId) return
    if (signals.length > 0) {
      setPendingProfileId(profileId)
    } else {
      loadProfile(profileId)
    }
  }

  function confirmProfileLoad(): void {
    if (pendingProfileId) {
      loadProfile(pendingProfileId)
      setPendingProfileId(null)
    }
  }

  function updateSignal(index: number, patch: Partial<SignalDef>): void {
    const updated = signals.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setSignals(updated)
  }

  function deleteSignal(index: number): void {
    setSignals(signals.filter((_, i) => i !== index))
  }

  function addSignal(): void {
    const next = buildDefaultSignal(signals.length)
    setSignals([...signals, next])
    requestAnimationFrame(() => {
      tableEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  function handleOptionalNumber(
    index: number,
    key: 'warningLevel' | 'dangerLevel' | 'highWarningLevel' | 'highDangerLevel',
    raw: string
  ): void {
    if (raw === '') {
      const updated = signals.map((s, i) => (i !== index ? s : omitKey(s, key)))
      setSignals(updated)
    } else {
      updateSignal(index, { [key]: parseFloat(raw) })
    }
  }

  function handleOptionalString(index: number, key: 'bitMask', raw: string): void {
    if (raw === '') {
      const updated = signals.map((s, i) => (i !== index ? s : omitKey(s, key)))
      setSignals(updated)
    } else {
      updateSignal(index, { [key]: raw })
    }
  }

  const pendingProfile = ECU_PROFILES.find((p) => p.id === pendingProfileId)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0D0D0D',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* RealDash XML import dialog */}
      {showImportDialog && (
        <RealDashImportDialog
          onImport={(imported) => {
            setSignals(imported)
          }}
          onClose={() => {
            setShowImportDialog(false)
          }}
        />
      )}

      {/* Confirmation modal */}
      {pendingProfileId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#161616',
              border: '1px solid #333333',
              borderRadius: 6,
              padding: '20px 24px',
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#CCCCCC' }}>
              Replace signal map?
            </div>
            <div style={{ fontSize: 12, color: '#888888', lineHeight: 1.6 }}>
              Loading <strong style={{ color: '#CCCCCC' }}>{pendingProfile?.name}</strong> will
              replace all current signals. Unsaved edits will be lost.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setPendingProfileId(null)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #333333',
                  borderRadius: 4,
                  color: '#888888',
                  fontSize: 12,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmProfileLoad}
                style={{
                  background: '#CC3333',
                  border: 'none',
                  borderRadius: 4,
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ECU profile selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 20px',
          borderBottom: '1px solid #1a1a1a',
          flexShrink: 0,
          background: '#0D0D0D',
        }}
      >
        <span style={{ fontSize: 11, color: '#666666', whiteSpace: 'nowrap' }}>ECU profile</span>
        <select
          value={activeProfileId}
          onChange={(e) => {
            handleProfileChange(e.target.value)
          }}
          style={{
            background: '#111111',
            border: '1px solid #2A2A2A',
            borderRadius: 4,
            color: '#CCCCCC',
            fontSize: 12,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
          aria-label="ECU profile"
        >
          {ECU_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {activeProfile && (
          <span style={{ fontSize: 11, color: '#444444' }}>{activeProfile.description}</span>
        )}
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          borderBottom: '1px solid #222222',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#CCCCCC', fontSize: 15, fontWeight: 600 }}>CAN Signals</span>
        <span
          style={{
            background: '#1a1a1a',
            border: '1px solid #333333',
            borderRadius: 10,
            padding: '1px 8px',
            fontSize: 11,
            color: '#AAAAAA',
          }}
        >
          {signals.length}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            void handleExport()
          }}
          disabled={signals.length === 0}
          style={{
            background: 'transparent',
            border: '1px solid #2A2A2A',
            borderRadius: 4,
            color: signals.length > 0 ? '#888888' : '#333333',
            fontSize: 12,
            padding: '5px 12px',
            cursor: signals.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Export signals.json
        </button>
        <button
          onClick={() => {
            setShowImportDialog(true)
          }}
          style={{
            background: 'transparent',
            border: '1px solid #2A2A2A',
            borderRadius: 4,
            color: '#888888',
            fontSize: 12,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          Import XML
        </button>
        <button
          onClick={addSignal}
          style={{
            background: '#CC3333',
            border: 'none',
            borderRadius: 4,
            color: '#FFFFFF',
            fontSize: 12,
            padding: '5px 12px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Add Signal
        </button>
      </div>

      {/* Unverified warning */}
      <div
        style={{
          background: '#1a1200',
          borderBottom: '1px solid #332200',
          padding: '6px 20px',
          fontSize: 11,
          color: '#BB8800',
          flexShrink: 0,
        }}
      >
        ⚠ CAN frame IDs and byte positions must be verified against your ECU&apos;s documentation
        before flashing.
      </div>

      {/* Scrollable table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            minWidth: 1250,
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: 130 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 55 }} />
            <col style={{ width: 38 }} />
            <col style={{ width: 38 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 32 }} />
          </colgroup>
          <thead>
            <tr>
              {[
                'name',
                'frameId',
                'byte',
                'len',
                'BE',
                '±',
                'scale',
                'offset',
                'unit',
                'min',
                'max',
                'warn',
                'danger',
                'highWarn',
                'highDanger',
                'timeout',
                'mask',
                '',
              ].map((col) => (
                <th key={col} style={thStyle}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((sig, idx) => (
              <SignalRow
                key={idx}
                signal={sig}
                onUpdate={(patch) => {
                  updateSignal(idx, patch)
                }}
                onUpdateOptionalNumber={(key, raw) => {
                  handleOptionalNumber(idx, key, raw)
                }}
                onUpdateOptionalString={(key, raw) => {
                  handleOptionalString(idx, key, raw)
                }}
                onDelete={() => {
                  deleteSignal(idx)
                }}
              />
            ))}
          </tbody>
        </table>
        <div ref={tableEndRef} />
      </div>
    </div>
  )
}

interface SignalRowProps {
  signal: SignalDef
  onUpdate: (patch: Partial<SignalDef>) => void
  onUpdateOptionalNumber: (
    key: 'warningLevel' | 'dangerLevel' | 'highWarningLevel' | 'highDangerLevel',
    raw: string
  ) => void
  onUpdateOptionalString: (key: 'bitMask', raw: string) => void
  onDelete: () => void
}

function SignalRow({
  signal,
  onUpdate,
  onUpdateOptionalNumber,
  onUpdateOptionalString,
  onDelete,
}: SignalRowProps) {
  return (
    <tr style={{ background: 'transparent' }}>
      {/* name */}
      <td style={tdStyle}>
        <input
          type="text"
          value={signal.name}
          onChange={(e) => {
            onUpdate({ name: e.target.value })
          }}
          style={{ ...inputStyle, fontFamily: 'monospace' }}
        />
      </td>

      {/* canFrameId */}
      <td style={tdStyle}>
        <input
          type="text"
          value={signal.canFrameId}
          onChange={(e) => {
            onUpdate({ canFrameId: e.target.value })
          }}
          style={{ ...inputStyle, fontFamily: 'monospace' }}
          placeholder="0x000"
        />
      </td>

      {/* startByte */}
      <td style={tdStyle}>
        <input
          type="number"
          min={0}
          max={7}
          value={signal.startByte}
          onChange={(e) => {
            onUpdate({ startByte: parseInt(e.target.value, 10) || 0 })
          }}
          style={inputStyle}
        />
      </td>

      {/* byteLength */}
      <td style={tdStyle}>
        <select
          value={signal.byteLength}
          onChange={(e) => {
            onUpdate({ byteLength: parseByteLength(e.target.value) })
          }}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
      </td>

      {/* bigEndian */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <Checkbox
          checked={signal.bigEndian}
          onCheckedChange={(checked) => {
            onUpdate({ bigEndian: checked === true })
          }}
        />
      </td>

      {/* signed */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <Checkbox
          checked={signal.signed}
          onCheckedChange={(checked) => {
            onUpdate({ signed: checked === true })
          }}
        />
      </td>

      {/* scale */}
      <td style={tdStyle}>
        <input
          type="number"
          step={0.001}
          value={signal.scale}
          onChange={(e) => {
            onUpdate({ scale: parseFloat(e.target.value) || 0 })
          }}
          style={inputStyle}
        />
      </td>

      {/* offset */}
      <td style={tdStyle}>
        <input
          type="number"
          step={0.1}
          value={signal.offset}
          onChange={(e) => {
            onUpdate({ offset: parseFloat(e.target.value) || 0 })
          }}
          style={inputStyle}
        />
      </td>

      {/* unit */}
      <td style={tdStyle}>
        <input
          type="text"
          value={signal.unit}
          onChange={(e) => {
            onUpdate({ unit: e.target.value })
          }}
          style={inputStyle}
          placeholder="rpm"
        />
      </td>

      {/* min */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.min}
          onChange={(e) => {
            onUpdate({ min: parseFloat(e.target.value) || 0 })
          }}
          style={inputStyle}
        />
      </td>

      {/* max */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.max}
          onChange={(e) => {
            onUpdate({ max: parseFloat(e.target.value) || 0 })
          }}
          style={inputStyle}
        />
      </td>

      {/* warningLevel */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.warningLevel ?? ''}
          onChange={(e) => {
            onUpdateOptionalNumber('warningLevel', e.target.value)
          }}
          style={inputStyle}
          placeholder="—"
        />
      </td>

      {/* dangerLevel */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.dangerLevel ?? ''}
          onChange={(e) => {
            onUpdateOptionalNumber('dangerLevel', e.target.value)
          }}
          style={inputStyle}
          placeholder="—"
        />
      </td>

      {/* highWarningLevel */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.highWarningLevel ?? ''}
          onChange={(e) => {
            onUpdateOptionalNumber('highWarningLevel', e.target.value)
          }}
          style={inputStyle}
          placeholder="—"
        />
      </td>

      {/* highDangerLevel */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.highDangerLevel ?? ''}
          onChange={(e) => {
            onUpdateOptionalNumber('highDangerLevel', e.target.value)
          }}
          style={inputStyle}
          placeholder="—"
        />
      </td>

      {/* timeoutMs */}
      <td style={tdStyle}>
        <input
          type="number"
          value={signal.timeoutMs}
          onChange={(e) => {
            onUpdate({ timeoutMs: parseInt(e.target.value, 10) || 0 })
          }}
          style={inputStyle}
          placeholder="ms"
        />
      </td>

      {/* bitMask */}
      <td style={tdStyle}>
        <input
          type="text"
          value={signal.bitMask ?? ''}
          onChange={(e) => {
            onUpdateOptionalString('bitMask', e.target.value)
          }}
          style={{ ...inputStyle, fontFamily: 'monospace' }}
          placeholder="0x01"
        />
      </td>

      {/* delete */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <DeleteButton onDelete={onDelete} />
      </td>
    </tr>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onClick={onDelete}
      title="Delete signal"
      style={{
        background: 'transparent',
        border: 'none',
        color: '#AAAAAA',
        fontSize: 14,
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: 3,
        lineHeight: 1,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#CC3333'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#AAAAAA'
      }}
    >
      ×
    </button>
  )
}
