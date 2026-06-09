import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

export interface ApplyConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetName: string
  newSignalCount: number
  currentSignalCount: number
  onConfirm: () => void
}

export function ApplyConfirmDialog({
  open,
  onOpenChange,
  targetName,
  newSignalCount,
  currentSignalCount,
  onConfirm,
}: ApplyConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the active signal map?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{targetName}</strong> will replace your current {currentSignalCount} signal
            {currentSignalCount === 1 ? '' : 's'} with {newSignalCount} new one
            {newSignalCount === 1 ? '' : 's'}. Widgets bound to a name that no longer exists will
            fall back to their idle visual. This change is not pushed to the device until you Burn.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Apply</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
