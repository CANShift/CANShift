import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import type { FirmwareSelection } from '../../stores/firmware-selection.store'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { useFlasher } from '../../hooks/useFlasher'
import type { FlasherState } from '../../hooks/useFlasher'
import { FlashSection } from './FlashSection'

const labelFor = (selection: FirmwareSelection, state: FlasherState): string => {
  if (state.kind === 'flashing') {
    const pct = state.total > 0 ? Math.round((state.written / state.total) * 100) : 0
    return `Flashing… ${String(pct)}%`
  }
  if (state.kind === 'success') return 'Flash again'
  if (selection.kind === 'release') return `Flash ${selection.release.tag}`
  if (selection.kind === 'local') return `Flash ${selection.firmware.name}`
  return 'Flash firmware'
}

const statusFor = (selection: FirmwareSelection, state: FlasherState) => {
  if (state.kind === 'success') return 'done'
  if (state.kind === 'flashing') return 'active'
  return selection.kind === 'none' ? 'disabled' : 'active'
}

export const FlashActionSection = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const { state, canFlash, flash, reset } = useFlasher()
  const status = statusFor(selection, state)

  return (
    <FlashSection step={3} title="Flash" status={status}>
      <ol style={instructionsStyle}>
        <li>
          <strong>Press and hold the BOOT button</strong> on the back of the dash. Keep it held — do
          not release.
        </li>
        <li>Click the Flash button below while still holding BOOT.</li>
        <li>
          Pick the dash's serial port in the browser prompt (it appears as{' '}
          <code>USB-SERIAL CH340</code>).
        </li>
        <li>
          Keep BOOT held until the progress bar starts moving (around <em>Writing at 2%</em>), then
          release. The full flash takes ~30 seconds.
        </li>
      </ol>
      {state.kind === 'flashing' && <ProgressBar written={state.written} total={state.total} />}
      {state.kind === 'success' && (
        <div style={successCardStyle}>
          <span style={successLabelStyle}>Flash complete</span>
          <span>
            Unplug the dash from USB and plug it back in to boot into the new firmware. The
            automatic reset from the flasher is unreliable on this board, so the power-cycle is the
            durable way to restart.
          </span>
        </div>
      )}
      {state.kind === 'error' && (
        <div style={errorCardStyle}>
          <span style={errorLabelStyle}>Flash failed</span>
          <span>{state.message}</span>
          <span style={errorHintStyle}>
            Most common cause: BOOT was not held long enough. Press and hold BOOT, then retry.
          </span>
        </div>
      )}
      <div style={actionsStyle}>
        <Button type="button" variant="default" size="default" disabled={!canFlash} onClick={flash}>
          {labelFor(selection, state)}
        </Button>
        {(state.kind === 'success' || state.kind === 'error') && (
          <Button type="button" variant="ghost" size="default" onClick={reset}>
            Reset
          </Button>
        )}
      </div>
    </FlashSection>
  )
}

interface ProgressBarProps {
  written: number
  total: number
}

const ProgressBar = ({ written, total }: ProgressBarProps) => {
  const pct = total > 0 ? Math.min(100, (written / total) * 100) : 0
  return (
    <div style={progressTrackStyle}>
      <div style={progressFillStyle(pct)} />
    </div>
  )
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
}

const progressTrackStyle: CSSProperties = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  background: 'hsl(var(--bg-inset))',
  overflow: 'hidden',
}

const progressFillStyle = (pct: number): CSSProperties => ({
  width: `${pct.toFixed(1)}%`,
  height: '100%',
  background: 'hsl(var(--brand-accent))',
  transition: 'width 120ms ease',
})

const successCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid hsl(var(--success))',
  background: 'hsl(var(--success) / 0.12)',
  fontSize: 12,
  color: 'hsl(var(--text))',
}

const successLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'hsl(var(--success))',
}

const errorCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid hsl(var(--destructive))',
  background: 'hsl(var(--destructive) / 0.12)',
  fontSize: 12,
  color: 'hsl(var(--text))',
}

const errorLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'hsl(var(--destructive))',
}

const errorHintStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
}

const instructionsStyle: CSSProperties = {
  margin: '0 0 4px 0',
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  lineHeight: 1.45,
  color: 'hsl(var(--text-dim))',
}
