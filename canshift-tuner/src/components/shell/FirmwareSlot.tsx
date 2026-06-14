import type { CSSProperties } from 'react'

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
      <div
        style={mismatchStyle}
        title={`Tuner expects firmware major ${String(compat.expected)}.x — device reports ${compat.version}. Burn disabled until the firmware is updated.`}
      >
        fw v{compat.version} · mismatch
      </div>
    )
  }
  if (version) {
    return (
      <div style={baseStyle} title={`Firmware v${version}`}>
        fw v{version}
      </div>
    )
  }
  return (
    <div style={baseStyle} title="Firmware version — waiting for handshake">
      fw —
    </div>
  )
}

const baseStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  fontFamily: 'monospace',
  letterSpacing: '0.04em',
}

const mismatchStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--destructive))',
  fontFamily: 'monospace',
  letterSpacing: '0.04em',
  padding: '2px 8px',
  border: '1px solid hsl(var(--destructive))',
  borderRadius: 3,
  cursor: 'help',
}
