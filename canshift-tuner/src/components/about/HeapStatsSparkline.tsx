import type { CSSProperties } from 'react'
import type { HeapStatsEntry } from '../../stores/device.store'

export interface HeapStatsSparklineProps {
  history: HeapStatsEntry[]
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 56

export const HeapStatsSparkline = ({
  history,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: HeapStatsSparklineProps) => {
  if (history.length < 2) {
    return <div style={emptyStyle(height)}>Collecting…</div>
  }

  const largestSeries = history.map((e) => e.largestInternal)
  const freeSeries = history.map((e) => e.freeInternal)
  const maxVal = Math.max(...freeSeries, 1)

  const largestPath = buildPath(largestSeries, maxVal, width, height)
  const freePath = buildPath(freeSeries, maxVal, width, height)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label="Heap-stats history sparkline"
      style={{ display: 'block' }}
    >
      <path
        d={freePath}
        fill="none"
        stroke="hsl(var(--text-muted))"
        strokeWidth={1}
        strokeOpacity={0.6}
      />
      <path
        d={largestPath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
      />
    </svg>
  )
}

const buildPath = (values: number[], maxVal: number, width: number, height: number): string => {
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = height - (v / maxVal) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const emptyStyle = (height: number): CSSProperties => ({
  height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
})
