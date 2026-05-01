// PushDiffDialog.tsx — Show a config diff summary before pushing to the device.
//
// Compares the current config against the last pushed config and lists
// widgets that were added, removed, or modified. The user can confirm
// the push or cancel.

import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { usePushDiffStore } from '../../stores/pushDiff.store'

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

interface WidgetDiff {
  added: Widget[]
  removed: Widget[]
  modified: Widget[]
}

function collectWidgets(config: DashboardConfig): Map<string, Widget> {
  const map = new Map<string, Widget>()
  for (const page of config.pages) {
    for (const widget of page.widgets) {
      map.set(widget.id, widget)
    }
  }
  return map
}

function computeDiff(current: DashboardConfig, last: DashboardConfig): WidgetDiff {
  const currentMap = collectWidgets(current)
  const lastMap = collectWidgets(last)

  const added: Widget[] = []
  const removed: Widget[] = []
  const modified: Widget[] = []

  for (const [id, widget] of currentMap) {
    const prev = lastMap.get(id)
    if (!prev) {
      added.push(widget)
    } else if (JSON.stringify(widget) !== JSON.stringify(prev)) {
      modified.push(widget)
    }
  }

  for (const [id, widget] of lastMap) {
    if (!currentMap.has(id)) {
      removed.push(widget)
    }
  }

  return { added, removed, modified }
}

function widgetLabel(w: Widget): string {
  const cfg = w.config
  if ('label' in cfg && typeof cfg.label === 'string') return cfg.label
  return w.type
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const PANEL: React.CSSProperties = {
  background: '#181818',
  border: '1px solid #2A2A2A',
  borderRadius: 6,
  padding: '20px 24px',
  width: 420,
  maxHeight: '80vh',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

function DiffSection({ label, items, color }: { label: string; items: Widget[]; color: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: '#666',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label} ({items.length})
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color, listStyle: 'disc' }}>
        {items.map((w) => (
          <li key={w.id}>{widgetLabel(w)}</li>
        ))}
      </ul>
    </div>
  )
}

export default function PushDiffDialog() {
  const visible = usePushDiffStore((s) => s.visible)
  const currentConfig = usePushDiffStore((s) => s.currentConfig)
  const lastPushedConfig = usePushDiffStore((s) => s.lastPushedConfig)
  const onConfirm = usePushDiffStore((s) => s.onConfirm)
  const dismiss = usePushDiffStore((s) => s.dismiss)

  if (!visible || !currentConfig) return null

  const handleConfirm = () => {
    dismiss()
    onConfirm?.()
  }

  const isFirstPush = !lastPushedConfig
  const diff = isFirstPush ? null : computeDiff(currentConfig, lastPushedConfig)

  const totalWidgets = currentConfig.pages.reduce((n, p) => n + p.widgets.length, 0)
  const hasChanges = diff
    ? diff.added.length + diff.removed.length + diff.modified.length > 0
    : true

  return (
    <div style={OVERLAY}>
      <div style={PANEL}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>
          {isFirstPush ? 'Push config to device' : 'Config changes'}
        </div>

        {isFirstPush ? (
          <div style={{ fontSize: 12, color: '#888' }}>
            First push: {totalWidgets} widget{totalWidgets !== 1 ? 's' : ''} across{' '}
            {currentConfig.pages.length} page{currentConfig.pages.length !== 1 ? 's' : ''}.
          </div>
        ) : !hasChanges ? (
          <div style={{ fontSize: 12, color: '#888' }}>No changes since last push.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diff && <DiffSection label="Added" items={diff.added} color="#44CC88" />}
            {diff && <DiffSection label="Removed" items={diff.removed} color="#FF6666" />}
            {diff && <DiffSection label="Modified" items={diff.modified} color="#FFAA44" />}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#555', borderTop: '1px solid #222', paddingTop: 10 }}>
          The device will reboot after receiving the config.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={dismiss}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              border: '1px solid #2A2A2A',
              background: 'transparent',
              color: '#888',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: '#CC3333',
              color: '#FFFFFF',
            }}
          >
            Push
          </button>
        </div>
      </div>
    </div>
  )
}
