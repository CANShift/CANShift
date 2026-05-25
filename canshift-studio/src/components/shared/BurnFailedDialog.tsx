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

// Metadata text shades not yet mapped to core design tokens. Hoisted as MIRROR
// consts per audit S-H-5 (umbrella #1015). `--text-dim` is the canonical value
// text and is adopted inline; the rest stay as mirrors pending design review.
const META_LABEL = '#888' // MIRROR: ≈ --text-muted (#8F8F8F), used for grid labels
const TRY_LABEL = '#666' // MIRROR: dimmer than --text-muted, uppercase section heading
const HINT_TEXT = '#CCC' // MIRROR: between --text-dim and --text, list item body

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
              color: META_LABEL,
            }}
          >
            <span>Elapsed</span>
            <span style={{ color: 'hsl(var(--text-dim))' }}>{String(details.elapsedMs)} ms</span>
            <span>Schema</span>
            <span style={{ color: 'hsl(var(--text-dim))' }}>v{details.schemaVersion}</span>
            <span>Payload</span>
            <span style={{ color: 'hsl(var(--text-dim))' }}>
              {formatPayloadSize(details.payloadBytes)}
            </span>
          </div>

          {details.hints.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: TRY_LABEL,
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
                  color: HINT_TEXT,
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
