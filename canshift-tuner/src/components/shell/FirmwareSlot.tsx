import type { CSSProperties } from 'react'
import { MONO_FONT } from '../../lib/typography'

export type FirmwareCompat =
  | { kind: 'unknown' }
  | { kind: 'compatible'; protocol: number }
  | { kind: 'mismatch'; expected: number; got: number; version: string }

export interface FirmwareSlotProps {
  version: string | null
  compat: FirmwareCompat
}

export const FirmwareSlot = ({ version, compat }: FirmwareSlotProps) => {
  if (compat.kind === 'mismatch') {
    return (
      <span
        style={mismatchStyle}
        title={`Tuner expects firmware major ${String(compat.expected)}.x — device reports ${compat.version}. Burn disabled until the firmware is updated.`}
      >
        fw v{compat.version} · mismatch
      </span>
    )
  }
  if (version) {
    return (
      <span style={baseStyle} title={`Firmware v${version}`}>
        fw v{version}
      </span>
    )
  }
  return (
    <span style={baseStyle} title="Firmware version — waiting for handshake">
      fw —
    </span>
  )
}

const baseStyle: CSSProperties = {
  display: 'inline',
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  fontFamily: MONO_FONT,
  letterSpacing: '0.04em',
}

const mismatchStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--destructive))',
  fontFamily: MONO_FONT,
  letterSpacing: '0.04em',
  padding: '2px 8px',
  border: '1px solid hsl(var(--destructive))',
  cursor: 'help',
}
