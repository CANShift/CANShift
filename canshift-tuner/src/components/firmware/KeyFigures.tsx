import type { CSSProperties } from 'react'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import type { FirmwareSelection } from '../../stores/firmware-selection.store'
import { findMergedAsset } from '../../lib/firmware/releases'
import { formatBytes } from '../../lib/format'
import { MONO_FONT } from '../../lib/typography'

export interface KeyFiguresProps {
  installedVersion: string | null
  latestStable: ReleaseInfo | null
  selection: FirmwareSelection
}

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 10)
}

export const KeyFigures = ({ installedVersion, latestStable, selection }: KeyFiguresProps) => {
  const latestAsset = latestStable ? findMergedAsset(latestStable) : null
  const updateAvailable =
    installedVersion !== null && latestStable !== null && latestStable.version !== installedVersion

  const selectedLabel =
    selection.kind === 'release'
      ? selection.release.tag
      : selection.kind === 'local'
        ? selection.firmware.name
        : '—'
  const selectedDetail =
    selection.kind === 'none'
      ? 'pick a build below'
      : `${formatBytes(selection.firmware.size)} · sha256 ${selection.firmware.sha256.slice(0, 12)}…`

  return (
    <div style={rowStyle}>
      <div style={cellStyle}>
        <span style={labelStyle}>INSTALLED</span>
        <span style={valueStyle}>{installedVersion ?? '—'}</span>
        <span style={detailStyle}>
          {installedVersion ? 'read from the device' : 'no device link'}
        </span>
      </div>
      <div style={cellStyle}>
        <span style={updateAvailable ? accentLabelStyle : labelStyle}>AVAILABLE</span>
        <span style={updateAvailable ? accentValueStyle : valueStyle}>
          {latestStable?.version ?? '—'}
        </span>
        <span style={detailStyle}>
          {latestStable
            ? `released ${formatDate(latestStable.publishedAt)}${latestAsset ? ` · ${formatBytes(latestAsset.sizeBytes)}` : ''}`
            : 'no stable release found'}
        </span>
      </div>
      <div style={lastCellStyle}>
        <span style={labelStyle}>SELECTED</span>
        <span style={valueStyle}>{selectedLabel}</span>
        <span style={detailStyle}>{selectedDetail}</span>
      </div>
    </div>
  )
}

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  borderBottom: '2px solid var(--brand-divider)',
}

const cellStyle: CSSProperties = {
  padding: '20px 24px',
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
}

const lastCellStyle: CSSProperties = {
  ...cellStyle,
  borderRight: 'none',
}

const labelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
}

const accentLabelStyle: CSSProperties = {
  ...labelStyle,
  color: 'hsl(var(--brand-accent))',
}

const valueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 30,
  lineHeight: 1.1,
  color: 'hsl(var(--brand-text))',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const accentValueStyle: CSSProperties = {
  ...valueStyle,
  color: 'hsl(var(--brand-accent))',
}

const detailStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
