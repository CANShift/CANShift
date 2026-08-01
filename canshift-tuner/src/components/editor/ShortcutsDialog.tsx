import { Fragment } from 'react'
import { MONO_FONT } from '../../lib/typography'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Del / ⌫', 'Delete selected widgets'],
  ['↑ ↓ ← →', 'Nudge 1px (Shift: 10px)'],
  ['⌘A', 'Select all'],
  ['⌘C / ⌘X / ⌘V', 'Copy / cut / paste'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'],
  ['⌘S', 'Burn to device'],
  ['Alt-drag', 'Disable snap (1px)'],
  ['⌘-scroll', 'Zoom'],
  ['Esc', 'Deselect / close'],
  ['?', 'This help'],
]

export interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ShortcutsDialog = ({ open, onOpenChange }: ShortcutsDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keyboard shortcuts</AlertDialogTitle>
        </AlertDialogHeader>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            fontSize: 13,
          }}
        >
          {SHORTCUTS.map(([keys, desc]) => (
            <Fragment key={keys}>
              <kbd style={{ fontFamily: MONO_FONT, color: 'hsl(var(--text))' }}>{keys}</kbd>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{desc}</span>
            </Fragment>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
