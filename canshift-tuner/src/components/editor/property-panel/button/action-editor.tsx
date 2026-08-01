import { CRUISE_CONTROL_OPS, type ButtonAction, type CruiseControlOp } from '@tmbk/canshift-core'

import { inputStyle, numberInputStyle } from '../shared'
import { CRUISE_STEP_OPS, HEX_FRAME_ID_REGEX } from './shared'
import { MONO_FONT } from '../../../../lib/typography'

interface ActionEditorProps {
  action: ButtonAction
  pageIds: string[]
  onUpdate: (updated: ButtonAction) => void
}

export const ActionEditor = ({ action, pageIds, onUpdate }: ActionEditorProps) => (
  <>
    {action.category === 'dashboard' && (
      <select
        style={{ ...inputStyle, fontSize: 11 }}
        value={action.pageId}
        onChange={(e) => {
          onUpdate({ ...action, pageId: e.target.value })
        }}
      >
        <option value="">— select page —</option>
        {pageIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    )}

    {action.category === 'ecu' && action.type === 'map_switch' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#666666' }}>Map</span>
        <input
          type="number"
          min={1}
          max={8}
          style={{ ...numberInputStyle, width: 50 }}
          value={action.mapIndex}
          onChange={(e) => {
            onUpdate({ ...action, mapIndex: Number(e.target.value) })
          }}
        />
      </div>
    )}

    {action.category === 'ecu' && action.type === 'can_raw' && (
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: '0 0 70px' }}>
          <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>FRAME ID</div>
          <input
            style={{ ...inputStyle, fontSize: 10 }}
            placeholder="0x123"
            value={`0x${action.frameId.toString(16).toUpperCase()}`}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!HEX_FRAME_ID_REGEX.test(raw)) return
              onUpdate({ ...action, frameId: parseInt(raw, 16) })
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>DATA (HEX)</div>
          <input
            style={{ ...inputStyle, fontSize: 10, fontFamily: MONO_FONT }}
            placeholder="0102030405060708"
            value={action.data}
            onChange={(e) => {
              onUpdate({ ...action, data: e.target.value })
            }}
          />
        </div>
      </div>
    )}

    {action.category === 'ecu' && action.type === 'cruise_control' && (
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>OP</div>
          <select
            style={{ ...inputStyle, fontSize: 11 }}
            value={action.op}
            onChange={(e) => {
              const nextOp = e.target.value as CruiseControlOp
              if (!CRUISE_STEP_OPS.has(nextOp) && action.stepKmh !== undefined) {
                const { stepKmh: _drop, ...rest } = action
                void _drop
                onUpdate({ ...rest, op: nextOp })
                return
              }
              onUpdate({ ...action, op: nextOp })
            }}
          >
            {CRUISE_CONTROL_OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
        {CRUISE_STEP_OPS.has(action.op) && (
          <div style={{ flex: '0 0 80px' }}>
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>STEP (KM/H)</div>
            <input
              type="number"
              min={1}
              max={20}
              style={{ ...numberInputStyle, fontSize: 11 }}
              value={action.stepKmh ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) onUpdate({ ...action, stepKmh: v })
              }}
            />
          </div>
        )}
      </div>
    )}
  </>
)
