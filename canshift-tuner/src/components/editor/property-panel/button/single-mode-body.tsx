import type { ButtonAction, SingleActionButtonConfig } from '@tmbk/canshift-core'

import { actionKey, newId } from '../../../../utils/list-keys'
import { Switch } from '@/components/ui/switch'
import { Field, type ConfigFieldsProps } from '../shared'
import { ActionRow } from './action-row'
import { AddActionMenu } from './add-action-menu'

interface SingleModeBodyProps {
  cfg: SingleActionButtonConfig
  pageIds: string[]
  onChange: ConfigFieldsProps['onChange']
}

export const SingleModeBody = ({ cfg, pageIds, onChange }: SingleModeBodyProps) => {
  const updateAction = (idx: number, updated: ButtonAction) => {
    const next = cfg.actions.map((a, i) => (i === idx ? updated : a))
    onChange({ config: { ...cfg, actions: next } })
  }

  const removeAction = (idx: number) => {
    onChange({ config: { ...cfg, actions: cfg.actions.filter((_, i) => i !== idx) } })
  }

  const addAction = (action: ButtonAction) => {
    const withId: ButtonAction = action.id !== undefined ? action : { ...action, id: newId() }
    onChange({ config: { ...cfg, actions: [...cfg.actions, withId] } })
  }

  return (
    <>
      <Field label="Behaviour">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#AAAAAA',
            cursor: 'pointer',
          }}
        >
          <Switch
            checked={cfg.isToggle === true}
            onCheckedChange={(checked) => {
              onChange({ config: { ...cfg, isToggle: checked } })
            }}
          />
          Toggle (stays active after press)
        </label>
      </Field>

      <div
        style={{
          fontSize: 10,
          color: '#AAAAAA',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
          marginTop: 4,
        }}
      >
        Actions
      </div>

      {cfg.actions.length === 0 && (
        <div style={{ fontSize: 11, color: '#AAAAAA', marginBottom: 6 }}>No actions yet.</div>
      )}

      {cfg.actions.map((action, idx) => (
        <ActionRow
          key={actionKey(action)}
          action={action}
          pageIds={pageIds}
          onUpdate={(updated) => {
            updateAction(idx, updated)
          }}
          onRemove={() => {
            removeAction(idx)
          }}
        />
      ))}

      <AddActionMenu pageIds={pageIds} onAdd={addAction} />
    </>
  )
}
