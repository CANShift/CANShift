// BurnFailedDialog.tsx — Blocking modal shown when burnConfig() fails.
//
// Surfaces the error message + remediation steps + the contextual metadata
// (elapsed time, schema version, payload size) so the user can't miss the
// failure (#376). Toast + ErrorBar continue to fire — this modal is additive.

import { useBurnFailureStore } from '../../stores/burnFailure.store'
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

function formatPayloadSize(bytes: number): string {
  const kb = bytes / 1024
  return `${kb.toFixed(1)} KB (${String(bytes)} bytes)`
}

export default function BurnFailedDialog() {
  const visible = useBurnFailureStore((s) => s.visible)
  const details = useBurnFailureStore((s) => s.details)
  const onRetry = useBurnFailureStore((s) => s.onRetry)
  const dismiss = useBurnFailureStore((s) => s.dismiss)

  if (!visible || !details) return null

  const handleRetry = () => {
    const retry = onRetry
    dismiss()
    retry?.()
  }

  return (
    <AlertDialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Config burn failed</AlertDialogTitle>
          <AlertDialogDescription>{details.message}</AlertDialogDescription>
        </AlertDialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 12,
              rowGap: 4,
              fontSize: 12,
              color: '#888',
            }}
          >
            <span>Elapsed</span>
            <span style={{ color: '#BBB' }}>{String(details.elapsedMs)} ms</span>
            <span>Schema</span>
            <span style={{ color: '#BBB' }}>v{details.schemaVersion}</span>
            <span>Payload</span>
            <span style={{ color: '#BBB' }}>{formatPayloadSize(details.payloadBytes)}</span>
          </div>

          {details.hints.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Try this
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: '#CCC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {details.hints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={dismiss}>Close</AlertDialogCancel>
          <AlertDialogAction onClick={handleRetry}>Retry</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
