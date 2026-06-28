import type { CSSProperties } from 'react'
import type { HeapStatsEntry } from '../../stores/device.store'
import { HeapStatsSparkline } from './HeapStatsSparkline'
import { formatBytes } from '../../lib/format'

export interface HeapStatsPanelProps {
  history: HeapStatsEntry[]
}

export const HeapStatsPanel = ({ history }: HeapStatsPanelProps) => {
  if (history.length === 0) {
    return (
      <div style={emptyStyle}>
        Waiting for the firmware to send a heap snapshot. The first frame lands within ~30 s of
        connect.
      </div>
    )
  }

  const latest = history[history.length - 1]
  if (!latest) return null
  const fragmentationPct = formatFragmentationPct(latest.freeInternal, latest.largestInternal)
  const psramRow =
    latest.freePsram !== null && latest.largestPsram !== null
      ? `${formatBytes(latest.freePsram)} · largest ${formatBytes(latest.largestPsram)}`
      : '— (no PSRAM)'

  return (
    <>
      <Row label="Free internal" value={formatBytes(latest.freeInternal)} />
      <Row label="Largest free block" value={formatBytes(latest.largestInternal)} />
      <Row label="Fragmentation" value={fragmentationPct} />
      <Row label="PSRAM free" value={psramRow} />
      <div style={sparklineRowStyle}>
        <HeapStatsSparkline history={history} />
      </div>
    </>
  )
}

interface RowProps {
  label: string
  value: string
}

const Row = ({ label, value }: RowProps) => {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  )
}

const formatFragmentationPct = (free: number, largest: number): string => {
  if (free === 0) return '—'
  const ratio = 1 - largest / free
  return `${(ratio * 100).toFixed(1)} %`
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 13,
}

const labelStyle: CSSProperties = {
  color: 'hsl(var(--text-dim))',
}

const valueStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  fontWeight: 500,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums',
}

const sparklineRowStyle: CSSProperties = {
  padding: '12px 14px',
  background: 'hsl(var(--bg-inset))',
  borderTop: '1px solid hsl(var(--border))',
}

const emptyStyle: CSSProperties = {
  padding: '14px',
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  background: 'hsl(var(--bg-inset))',
}
