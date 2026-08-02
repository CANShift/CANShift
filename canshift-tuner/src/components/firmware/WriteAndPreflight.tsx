import type { CSSProperties, ReactNode } from 'react'
import type { FirmwareSelection } from '../../stores/firmware-selection.store'
import { formatBytes } from '../../lib/format'
import { MONO_FONT } from '../../lib/typography'

export interface WriteAndPreflightProps {
  selection: FirmwareSelection
}

const isWebSerialAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'serial' in navigator

const CheckRow = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <div style={ok ? checkRowStyle : pendingRowStyle}>
    <span style={ok ? checkMarkStyle : pendingMarkStyle}>{ok ? '✓' : '—'}</span>
    {children}
  </div>
)

export const WriteAndPreflight = ({ selection }: WriteAndPreflightProps) => {
  const hasBuild = selection.kind !== 'none'
  const webSerial = isWebSerialAvailable()

  return (
    <div style={columnsStyle}>
      <div style={leftColumnStyle}>
        <span style={columnTitleStyle}>WHAT GETS WRITTEN</span>
        <div style={writtenRowStyle}>
          <span style={checkedBoxStyle} />
          Firmware image — full flash, checksum-verified
        </div>
        <div style={writtenDimRowStyle}>
          <span style={uncheckedBoxStyle} />
          Dashboard layout — burned separately via BURN TO DEVICE
        </div>
        <div style={writtenDimRowStyle}>
          <span style={uncheckedBoxStyle} />
          User settings and logs — kept, never erased by the flasher
        </div>
      </div>
      <div style={rightColumnStyle}>
        <span style={columnTitleStyle}>PRE-FLIGHT</span>
        <CheckRow ok={webSerial}>
          {webSerial
            ? 'WebSerial available in this browser'
            : 'WebSerial unavailable — use Chrome or Edge'}
        </CheckRow>
        <CheckRow ok={hasBuild}>
          {hasBuild
            ? `Build ready — ${formatBytes(selection.firmware.size)}, sha256 ${selection.firmware.sha256.slice(0, 12)}…`
            : 'No build selected or downloaded yet'}
        </CheckRow>
        <CheckRow ok={false}>Hold BOOT on the back of the dash while starting the flash</CheckRow>
      </div>
    </div>
  )
}

const columnsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  borderBottom: '2px solid var(--brand-divider)',
}

const leftColumnStyle: CSSProperties = {
  padding: '20px 24px',
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const rightColumnStyle: CSSProperties = {
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const columnTitleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const writtenRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
}

const writtenDimRowStyle: CSSProperties = {
  ...writtenRowStyle,
  color: 'hsl(var(--brand-neutral-700))',
}

const checkedBoxStyle: CSSProperties = {
  width: 15,
  height: 15,
  flexShrink: 0,
  border: '2px solid hsl(var(--brand-accent))',
  background: 'hsl(var(--brand-accent))',
}

const uncheckedBoxStyle: CSSProperties = {
  width: 15,
  height: 15,
  flexShrink: 0,
  border: '2px solid hsl(var(--brand-neutral-400))',
}

const checkRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
}

const pendingRowStyle: CSSProperties = {
  ...checkRowStyle,
  color: 'hsl(var(--brand-neutral-700))',
}

const checkMarkStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  color: 'hsl(var(--brand-accent))',
}

const pendingMarkStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  color: 'hsl(var(--brand-neutral-500))',
}
