import type { CSSProperties } from 'react'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { FlashSection } from './FlashSection'
import { LocalFirmwarePicker } from './LocalFirmwarePicker'

export const FirmwareSection = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const status = selection.kind === 'local' ? 'done' : 'active'

  return (
    <FlashSection step={2} title="Firmware" status={status}>
      <p>Pick a local .bin built from source. GitHub release picker lands in a follow-up PR.</p>
      <LocalFirmwarePicker />
      <p style={hintStyle}>
        Files larger than 16 MiB or empty files are rejected before they reach the flash flow. The
        SHA-256 is computed at read time so a corrupted upload can't slip through.
      </p>
    </FlashSection>
  )
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  margin: 0,
}
