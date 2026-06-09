// FirmwareSlot.tsx — Header pill that surfaces the firmware version reported
// by the connect-time handshake (#1365). Flips to a destructive variant when
// the device runs a wrong-major firmware so the user can correlate the Header
// signal with the disabled Burn button.

import type { CSSProperties } from 'react'
import type { FirmwareCompat } from '../../stores/device.store'

export interface FirmwareSlotProps {
  /** Firmware semver reported by `CMD_QUERY_VERSION`, `null` until handshake lands. */
  version: string | null
  /** Compatibility verdict from `useVersionHandshake`. */
  compat: FirmwareCompat
}

export function FirmwareSlot({ version, compat }: FirmwareSlotProps) {
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
