import type { CSSProperties } from 'react'
import { useDeviceStore } from '../../stores/device.store'

const LOW_HEAP_THRESHOLD_BYTES = 10 * 1024

export function HeapLowBanner() {
  const heapStats = useDeviceStore((s) => s.heapStats)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)

  if (!connected || simulationMode || heapStats.length === 0) return null
  const latest = heapStats[heapStats.length - 1]
  if (!latest || latest.largestInternal >= LOW_HEAP_THRESHOLD_BYTES) return null

  return (
    <div role="alert" style={bannerStyle}>
      <span style={titleStyle}>Heap low</span>
      <span>
        Largest contiguous free block is{' '}
        <strong>{formatBytes(latest.largestInternal)}</strong> — below the{' '}
        {formatBytes(LOW_HEAP_THRESHOLD_BYTES)} safety floor. Subsequent allocations (font load,
        icon decode, JSON parse) may fail silently. Reboot the dash to defragment.
      </span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${String(bytes)} B`
}

const bannerStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: 'hsl(var(--accent) / 0.18)',
  borderBottom: '1px solid hsl(var(--accent))',
  color: 'hsl(var(--text))',
  fontSize: 12,
}

const titleStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}
