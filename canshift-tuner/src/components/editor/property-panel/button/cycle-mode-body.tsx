import { MAX_CYCLE_STATES, MIN_CYCLE_STATES } from '@tmbk/canshift-core'

import type { ConfigFieldsProps } from '../shared'
import { CycleStateRow } from './cycle-state-row'
import { defaultNavigateAction, type CycleConfig, type CycleState } from './shared'

interface CycleModeBodyProps {
  cfg: CycleConfig
  pageIds: string[]
  onChange: ConfigFieldsProps['onChange']
}

export const CycleModeBody = ({ cfg, pageIds, onChange }: CycleModeBodyProps) => {
  const updateState = (idx: number, updated: CycleState) => {
    const next = cfg.states.map((s, i) => (i === idx ? updated : s))
    onChange({ config: { ...cfg, states: next } })
  }

  const removeState = (idx: number) => {
    if (cfg.states.length <= MIN_CYCLE_STATES) return
    const next = cfg.states.filter((_, i) => i !== idx)
    const nextInitial =
      cfg.initialActiveIndex >= next.length ? next.length - 1 : cfg.initialActiveIndex
    onChange({ config: { ...cfg, states: next, initialActiveIndex: nextInitial } })
  }

  const addState = () => {
    if (cfg.states.length >= MAX_CYCLE_STATES) return
    const next: CycleState = {
      label: `State ${String(cfg.states.length + 1)}`,
      action: defaultNavigateAction(pageIds),
    }
    onChange({ config: { ...cfg, states: [...cfg.states, next] } })
  }

  const setInitial = (idx: number) => {
    onChange({ config: { ...cfg, initialActiveIndex: idx } })
  }

  const canAdd = cfg.states.length < MAX_CYCLE_STATES
  const canRemove = cfg.states.length > MIN_CYCLE_STATES

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 4,
          marginBottom: 5,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: 'hsl(var(--brand-neutral-600))',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Cycle states
        </div>
        <div style={{ fontSize: 10, color: 'hsl(var(--brand-neutral-500))' }}>
          {cfg.states.length} / {MAX_CYCLE_STATES}
        </div>
      </div>

      {cfg.states.map((state, idx) => (
        <CycleStateRow
          key={idx}
          state={state}
          index={idx}
          isInitial={idx === cfg.initialActiveIndex}
          canRemove={canRemove}
          pageIds={pageIds}
          onUpdate={(updated) => {
            updateState(idx, updated)
          }}
          onRemove={() => {
            removeState(idx)
          }}
          onSetInitial={() => {
            setInitial(idx)
          }}
        />
      ))}

      <button
        onClick={addState}
        disabled={!canAdd}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          background: 'transparent',
          border: `1px solid ${canAdd ? '#7788CC44' : 'hsl(var(--brand-neutral-300))'}`,
          color: canAdd ? '#7788CC' : 'hsl(var(--brand-neutral-500))',
          cursor: canAdd ? 'pointer' : 'not-allowed',
          marginTop: 2,
        }}
      >
        + Add state
      </button>
    </>
  )
}
