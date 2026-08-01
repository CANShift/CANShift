import { useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import { Colors, TabularNums, Typography, Spacing } from '../../theme'
import { getSignalColor } from '../../theme/signal-colors'
import { SIGNAL_META, type SignalKey } from '../../constants/ble'
import { SIGNAL_RANGE, buildPoints, formatTime, formatValue } from '../../lib/graph-math'
import type { SignalValues } from '../../stores/telemetry.store'
import { useGraphSeries } from '../../hooks/use-graph-series'
import { SignalPillRow } from './SignalPillRow'
import { GraphControls } from './GraphControls'

export interface ChartPanelProps {
  visibleSignals: SignalKey[]
  windowSecs: number
  paused: boolean
  pausedAt: number
  onTogglePause: () => void
  onSetWindow: (s: number) => void
  onClear: () => void
  onToggleSignal: (key: SignalKey) => void
  compact: boolean
}

export const ChartPanel = ({
  visibleSignals,
  windowSecs,
  paused,
  pausedAt,
  onTogglePause,
  onSetWindow,
  onClear,
  onToggleSignal,
  compact,
}: ChartPanelProps) => {
  const [chartSize, setChartSize] = useState({ width: 300, height: 160 })

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setChartSize({ width, height })
  }, [])

  const { rolling, windowStart, windowEnd, hasData } = useGraphSeries(windowSecs, paused, pausedAt)

  const lines = useMemo(() => {
    const latest: SignalValues = rolling[rolling.length - 1]?.v ?? {}
    return visibleSignals.map((key) => ({
      key,
      color: getSignalColor(key),
      points: buildPoints(rolling, key, windowStart, windowEnd, chartSize.width, chartSize.height),
      latestValue: latest[key],
    }))
  }, [rolling, windowStart, windowEnd, visibleSignals, chartSize])

  const vGap = compact ? 2 : Spacing.xs

  return (
    <>
      <SignalPillRow visibleSignals={visibleSignals} onToggleSignal={onToggleSignal} vGap={vGap} />

      <GraphControls
        paused={paused}
        windowSecs={windowSecs}
        onTogglePause={onTogglePause}
        onSetWindow={onSetWindow}
        onClear={onClear}
        vGap={vGap}
      />

      <View style={styles.chartContainer} onLayout={onChartLayout}>
        {!hasData ? (
          <View style={styles.noDataOverlay}>
            <Text style={styles.noDataText}>No telemetry data yet</Text>
          </View>
        ) : (
          <Svg width={chartSize.width} height={chartSize.height}>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line
                key={f}
                x1={0}
                y1={chartSize.height * f}
                x2={chartSize.width}
                y2={chartSize.height * f}
                stroke={Colors.border}
                strokeWidth={1}
              />
            ))}
            {lines.map((line) =>
              line.points ? (
                <Polyline
                  key={line.key}
                  points={line.points}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null
            )}
            {lines.map((line) => {
              const range = SIGNAL_RANGE[line.key]
              if (line.latestValue === undefined) return null
              const norm = Math.max(
                0,
                Math.min(1, (line.latestValue - range.min) / (range.max - range.min))
              )
              const y = Math.max(10, Math.min(chartSize.height - 4, (1 - norm) * chartSize.height))
              return (
                <SvgText
                  key={line.key}
                  transform={`translate(${String(chartSize.width - 4)}, ${String(y)})`}
                  fill={line.color}
                  fontSize={9}
                  textAnchor="end"
                  fontWeight="600"
                >
                  {SIGNAL_META[line.key].label} {formatValue(line.key, line.latestValue)}
                </SvgText>
              )
            })}
          </Svg>
        )}
      </View>

      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>{formatTime(windowStart)}</Text>
        <Text style={styles.timeLabel}>{formatTime((windowStart + windowEnd) / 2)}</Text>
        <Text style={styles.timeLabel}>{formatTime(windowEnd)}</Text>
      </View>

      {hasData && (
        <View style={[styles.valuesGrid, { paddingVertical: vGap + 2 }]}>
          {lines.map((line) => (
            <View key={line.key} style={styles.valueChip}>
              <Text style={[styles.valueKey, { color: line.color }]}>
                {SIGNAL_META[line.key].label}
              </Text>
              <Text style={[styles.valueNum, { color: line.color }]}>
                {formatValue(line.key, line.latestValue)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  chartContainer: {
    flex: 1,
    backgroundColor: Colors.bgInset,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  noDataOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: Colors.textMuted, fontSize: Typography.sm },

  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timeLabel: { fontSize: Typography.xxs, color: Colors.textMuted, fontVariant: TabularNums },

  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
  },
  valueChip: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  valueKey: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  valueNum: { fontSize: 15, fontWeight: '700', fontVariant: TabularNums },
})
