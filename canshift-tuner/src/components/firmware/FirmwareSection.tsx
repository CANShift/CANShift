import type { CSSProperties } from 'react'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { FlashSection } from './FlashSection'
import { LocalFirmwarePicker } from './LocalFirmwarePicker'
import { ReleasePicker } from './ReleasePicker'

export const FirmwareSection = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const status = selection.kind === 'none' ? 'active' : 'done'

  return (
    <FlashSection step={2} title="Firmware" status={status}>
      <p>Pick a release from GitHub, or upload a local .bin built from source.</p>
      <ReleasePicker />
      <div style={dividerStyle}>
        <span style={dividerLineStyle} />
        <span style={dividerLabelStyle}>OR</span>
        <span style={dividerLineStyle} />
      </div>
      <LocalFirmwarePicker />
      <p style={hintStyle}>
        Files larger than 16 MiB or empty files are rejected. SHA-256 is computed at read time so a
        corrupted upload or download cannot slip through.
      </p>
    </FlashSection>
  )
}

const dividerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  margin: '4px 0',
}

const dividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: 'hsl(var(--border))',
}

const dividerLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'hsl(var(--text-muted))',
  fontWeight: 600,
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  margin: 0,
}
