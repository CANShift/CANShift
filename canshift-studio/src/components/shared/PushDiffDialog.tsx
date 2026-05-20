// PushDiffDialog.tsx — Show a config diff summary before pushing to the device.
//
// Compares the current config against the last pushed config and lists
// widgets that were added, removed, or modified. The user can confirm
// the push or cancel.

import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { usePushDiffStore } from '../../stores/pushDiff.store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

interface DiffSectionProps {
  label: string
  items: Widget[]
  colorClass: string
}

function DiffSection({ label, items, colorClass }: DiffSectionProps) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-[0.06em] text-text-muted">
        {label} ({items.length})
      </div>
      <ul className={`m-0 list-disc pl-4 text-xs ${colorClass}`}>
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

  if (!currentConfig) return null

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

  const description = isFirstPush
    ? `First push: ${String(totalWidgets)} widget${totalWidgets !== 1 ? 's' : ''} across ${String(
        currentConfig.pages.length
      )} page${currentConfig.pages.length !== 1 ? 's' : ''}.`
    : hasChanges
      ? 'Review the widget changes before pushing to the device.'
      : 'No changes since last push.'

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isFirstPush ? 'Push config to device' : 'Config changes'}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!isFirstPush && hasChanges && diff && (
          <div className="flex flex-col gap-2.5">
            <DiffSection label="Added" items={diff.added} colorClass="text-success" />
            <DiffSection label="Removed" items={diff.removed} colorClass="text-danger" />
            <DiffSection label="Modified" items={diff.modified} colorClass="text-warning" />
          </div>
        )}

        <div className="border-t border-border pt-2.5 text-[11px] text-text-muted">
          The device will reboot after receiving the config.
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={dismiss}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm}>
            Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
