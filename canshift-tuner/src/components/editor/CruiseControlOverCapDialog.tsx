import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

export interface CruiseControlOverCapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageIds: string[]
  maxPages: number
}

export const CruiseControlOverCapDialog = ({
  open,
  onOpenChange,
  pageIds,
  maxPages,
}: CruiseControlOverCapDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cannot add cruise-control page</AlertDialogTitle>
          <AlertDialogDescription>
            You already have {pageIds.length.toString()} pages — the firmware accepts at most{' '}
            {maxPages.toString()}. Remove a page first, then enable cruise control.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ol
          style={{
            margin: '12px 0 0',
            paddingLeft: 24,
            fontSize: 12,
            color: 'hsl(var(--text-dim))',
          }}
        >
          {pageIds.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ol>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
