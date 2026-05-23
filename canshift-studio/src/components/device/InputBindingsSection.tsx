// InputBindingsSection.tsx — Editor for physical GPIO button bindings (#833).
//
// Lives inside DeviceConfigRoute. Each entry maps one GPIO press (pin +
// debounce + press kind) to one dashboard action and optionally a shared
// signal name so an on-screen button widget bound to the same signal can
// stay in lockstep with the physical button.

import { useEffect } from 'react'
import { useInputBindingsStore } from '../../stores/inputBindings.store'
import type {
  ButtonAction,
  CruiseControlOp,
  InputActiveLevel,
  InputBinding,
  InputPressKind,
} from '@tmbk/canshift-core'
import { MAX_INPUT_BINDINGS } from '@tmbk/canshift-core'

const CRUISE_OPS: CruiseControlOp[] = [
  'on',
  'off',
  'toggle',
  'set',
  'resume',
  'increment',
  'decrement',
]

const PRESS_KINDS: InputPressKind[] = ['short', 'long', 'double']
const ACTIVE_LEVELS: InputActiveLevel[] = ['low', 'high']

// SPI flash pins (6-11) and out-of-range values are rejected by the core
// schema; we keep the UI from offering them so the user gets immediate feedback.
const INPUT_PIN_OPTIONS: number[] = (() => {
  const out: number[] = []
  for (let p = 0; p <= 39; p += 1) {
    if (p >= 6 && p <= 11) continue
    out.push(p)
  }
  return out
})()

const ACTION_TYPES = ['navigate', 'map_switch', 'can_raw', 'cruise_control'] as const

const section: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #222222',
  borderRadius: 8,
  padding: '16px 20px',
  marginBottom: 16,
}

const label: React.CSSProperties = {
  fontSize: 10,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: '#0D0D0D',
  border: '1px solid #2A2A2A',
  borderRadius: 4,
  color: '#CCCCCC',
  fontSize: 12,
  boxSizing: 'border-box',
}

const card: React.CSSProperties = {
  background: '#0F0F0F',
  border: '1px solid #1F1F1F',
  borderRadius: 6,
  padding: '12px',
  marginBottom: 10,
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
  marginBottom: 10,
}

const smallButton: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
  border: '1px solid #2A2A2A',
  background: '#1A1A1A',
  color: '#AAAAAA',
}

function newBinding(idx: number): InputBinding {
  return {
    id: `binding_${String(idx + 1)}`,
    pin: 32,
    active: 'low',
    pullup: true,
    debounceMs: 20,
    kind: 'short',
    action: { category: 'dashboard', type: 'navigate', pageId: '' },
  }
}

function actionFactory(type: (typeof ACTION_TYPES)[number]): ButtonAction {
  switch (type) {
    case 'navigate':
      return { category: 'dashboard', type: 'navigate', pageId: '' }
    case 'map_switch':
      return { category: 'ecu', type: 'map_switch', mapIndex: 1 }
    case 'can_raw':
      return { category: 'ecu', type: 'can_raw', frameId: 0, data: '' }
    case 'cruise_control':
      return { category: 'ecu', type: 'cruise_control', op: 'toggle' }
  }
}

export default function InputBindingsSection() {
  const bindings = useInputBindingsStore((s) => s.bindings)
  const loaded = useInputBindingsStore((s) => s.loaded)
  const saveStatus = useInputBindingsStore((s) => s.saveStatus)
  const saveError = useInputBindingsStore((s) => s.saveError)
  const load = useInputBindingsStore((s) => s.load)
  const addBinding = useInputBindingsStore((s) => s.addBinding)
  const removeBinding = useInputBindingsStore((s) => s.removeBinding)
  const updateBinding = useInputBindingsStore((s) => s.updateBinding)
  const save = useInputBindingsStore((s) => s.save)
  const clearSaveStatus = useInputBindingsStore((s) => s.clearSaveStatus)

  // Idiomatic Zustand bridge — the side effect is in the store action; this
  // effect only schedules the first invocation when the consumer mounts.
  useEffect(() => {
    void load()
  }, [load])

  // Fade the "Saved" badge after 2 s — preserves the original UX.
  useEffect(() => {
    if (saveStatus !== 'saved') return
    const t = setTimeout(() => {
      clearSaveStatus()
    }, 2000)
    return () => {
      clearTimeout(t)
    }
  }, [saveStatus, clearSaveStatus])

  const saving = saveStatus === 'saving'

  if (!loaded) return null

  return (
    <div style={section}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA' }}>
          Physical Buttons
          <span style={{ color: '#444444', fontWeight: 400, marginLeft: 8 }}>
            {bindings.length} / {MAX_INPUT_BINDINGS}
          </span>
        </div>
        <button
          type="button"
          style={smallButton}
          disabled={bindings.length >= MAX_INPUT_BINDINGS}
          onClick={() => {
            addBinding(newBinding(bindings.length))
          }}
        >
          + Add binding
        </button>
      </div>

      {bindings.length === 0 && (
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 12 }}>
          No physical buttons configured. Wire a button to a free input-capable GPIO (avoid 6-11 —
          SPI flash) and add a binding above.
        </div>
      )}

      {bindings.map((b, idx) => (
        <BindingCard
          key={idx}
          binding={b}
          onChange={(patch) => {
            updateBinding(idx, patch)
          }}
          onRemove={() => {
            removeBinding(idx)
          }}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            void save()
          }}
          disabled={saving}
          style={{
            padding: '6px 16px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            border: 'none',
            background: saving ? '#332222' : '#CC3333',
            color: saving ? '#666666' : '#FFFFFF',
          }}
        >
          {saving ? 'Saving…' : 'Save bindings'}
        </button>
        {saveStatus === 'saved' && <span style={{ fontSize: 11, color: '#44CC44' }}>Saved</span>}
        {saveError && <span style={{ fontSize: 11, color: '#CC3333' }}>{saveError}</span>}
      </div>
    </div>
  )
}

interface BindingCardProps {
  binding: InputBinding
  onChange: (patch: Partial<InputBinding>) => void
  onRemove: () => void
}

function BindingCard({ binding, onChange, onRemove }: BindingCardProps) {
  return (
    <div style={card}>
      <div style={grid}>
        <div>
          <span style={label}>ID</span>
          <input
            type="text"
            value={binding.id}
            maxLength={32}
            onChange={(e) => {
              onChange({ id: e.target.value })
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <span style={label}>GPIO Pin</span>
          <select
            value={binding.pin}
            onChange={(e) => {
              onChange({ pin: parseInt(e.target.value, 10) })
            }}
            style={inputStyle}
          >
            {INPUT_PIN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                GPIO {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={label}>Active level</span>
          <select
            value={binding.active}
            onChange={(e) => {
              onChange({ active: e.target.value as InputActiveLevel })
            }}
            style={inputStyle}
          >
            {ACTIVE_LEVELS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={label}>Press kind</span>
          <select
            value={binding.kind}
            onChange={(e) => {
              onChange({ kind: e.target.value as InputPressKind })
            }}
            style={inputStyle}
          >
            {PRESS_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={grid}>
        <div>
          <span style={label}>Debounce (ms)</span>
          <input
            type="number"
            min={1}
            max={500}
            value={binding.debounceMs}
            onChange={(e) => {
              onChange({ debounceMs: parseInt(e.target.value, 10) })
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <span style={label}>Internal pullup</span>
          <select
            value={binding.pullup ? 'on' : 'off'}
            onChange={(e) => {
              onChange({ pullup: e.target.value === 'on' })
            }}
            style={inputStyle}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <span style={label}>Shared signal (optional)</span>
          <input
            type="text"
            placeholder="e.g. als_armed"
            value={binding.signal ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChange(v === '' ? { signal: undefined } : { signal: v })
            }}
            style={inputStyle}
          />
        </div>
      </div>

      <ActionEditor
        action={binding.action}
        onChange={(action) => {
          onChange({ action })
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={onRemove} style={{ ...smallButton, color: '#CC6666' }}>
          Remove
        </button>
      </div>
    </div>
  )
}

interface ActionEditorProps {
  action: ButtonAction
  onChange: (action: ButtonAction) => void
}

function ActionEditor({ action, onChange }: ActionEditorProps) {
  return (
    <div
      style={{
        borderTop: '1px solid #1A1A1A',
        paddingTop: 10,
      }}
    >
      <div style={grid}>
        <div>
          <span style={label}>Action</span>
          <select
            value={action.type}
            onChange={(e) => {
              onChange(actionFactory(e.target.value as (typeof ACTION_TYPES)[number]))
            }}
            style={inputStyle}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {action.type === 'navigate' && (
          <div style={{ gridColumn: 'span 3' }}>
            <span style={label}>Page ID</span>
            <input
              type="text"
              value={action.pageId}
              onChange={(e) => {
                onChange({ ...action, pageId: e.target.value })
              }}
              style={inputStyle}
            />
          </div>
        )}
        {action.type === 'map_switch' && (
          <div>
            <span style={label}>Map index</span>
            <input
              type="number"
              min={0}
              max={255}
              value={action.mapIndex}
              onChange={(e) => {
                onChange({ ...action, mapIndex: parseInt(e.target.value, 10) })
              }}
              style={inputStyle}
            />
          </div>
        )}
        {action.type === 'can_raw' && (
          <>
            <div>
              <span style={label}>Frame ID (decimal)</span>
              <input
                type="number"
                min={0}
                value={action.frameId}
                onChange={(e) => {
                  onChange({ ...action, frameId: parseInt(e.target.value, 10) })
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={label}>Data (hex)</span>
              <input
                type="text"
                placeholder="DEADBEEF"
                value={action.data}
                onChange={(e) => {
                  onChange({ ...action, data: e.target.value.toUpperCase() })
                }}
                style={inputStyle}
              />
            </div>
          </>
        )}
        {action.type === 'cruise_control' && (
          <>
            <div>
              <span style={label}>Op</span>
              <select
                value={action.op}
                onChange={(e) => {
                  onChange({ ...action, op: e.target.value as CruiseControlOp })
                }}
                style={inputStyle}
              >
                {CRUISE_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
            {(action.op === 'increment' || action.op === 'decrement') && (
              <div>
                <span style={label}>Step (km/h)</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={action.stepKmh ?? 1}
                  onChange={(e) => {
                    onChange({ ...action, stepKmh: parseInt(e.target.value, 10) })
                  }}
                  style={inputStyle}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
