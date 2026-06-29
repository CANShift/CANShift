import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import { useGraphTick } from '../../hooks/use-graph-tick'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'
import { getSignalColor } from '../../theme/signal-colors'
import { TelemetrySample, getRange, getWriteIndex } from '../../stores/telemetry.store'
import { SIGNAL_META } from '../../constants/ble'
import { ingestIncremental } from '../../screens/graph-buffer'
import { SIGNAL_RANGE, buildPoints, formatTime, formatValue } from '../../lib/graph-math'

const WINDOW_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
]

const ALL_SIGNALS = Object.keys(SIGNAL_META)

export interface ChartPanelProps {
  visibleSignals: string[]
  windowSecs: number
  paused: boolean
  pausedAt: number
  onTogglePause: () => void
  onSetWindow: (s: number) => void
  onClear: () => void
  onToggleSignal: (key: string) => void
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
  const tick = useGraphTick(paused)

  const rollingRef = useRef<TelemetrySample[]>([])
  const lastSeenIndexRef = useRef<number>(0)

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setChartSize({ width, height })
  }, [])

  const chartData = useMemo(() => {
    const now = paused ? pausedAt : Date.now()
    const windowStart = now - windowSecs * 1000

    const currentWriteIndex = getWriteIndex()
    if (currentWriteIndex < lastSeenIndexRef.current) {
      rollingRef.current = []
      lastSeenIndexRef.current = 0
    }
    const fresh =
      currentWriteIndex > lastSeenIndexRef.current
        ? getRange(lastSeenIndexRef.current, currentWriteIndex)
        : []
    lastSeenIndexRef.current = currentWriteIndex

    const rolling = rollingRef.current
    ingestIncremental(rolling, fresh, windowStart)

    const latest: Record<string, number> = rolling[rolling.length - 1]?.v ?? {}
    const lines = visibleSignals.map((key) => ({
      key,
      color: getSignalColor(key),
      points: buildPoints(rolling, key, windowStart, now, chartSize.width, chartSize.height),
      latestValue: latest[key],
    }))
    return {
      lines,
      windowStart,
      windowEnd: now,
      hasData: rolling.length > 1,
    }
  }, [tick, visibleSignals, windowSecs, paused, pausedAt, chartSize])

  useEffect(() => {
    const writeIdx = getWriteIndex()
    const fromIdx = Math.max(0, writeIdx - 3000)
    rollingRef.current = [...getRange(fromIdx, writeIdx)]
    lastSeenIndexRef.current = writeIdx
  }, [windowSecs])

  const vGap = compact ? 2 : Spacing.xs

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.pillRow, { paddingVertical: vGap }]}
        style={styles.pillBar}
      >
        {ALL_SIGNALS.map((key) => {
          const active = visibleSignals.includes(key)
          const color = getSignalColor(key)
          return (
            <TouchableOpacity
              key={key}
              style={[styles.pill, active && { borderColor: color, backgroundColor: `${color}22` }]}
              onPress={() => {
                onToggleSignal(key)
              }}
              hitSlop={HitSlop.default}
            >
              <View
                style={[styles.pillDot, { backgroundColor: active ? color : Colors.textMuted }]}
              />
              <Text style={[styles.pillLabel, active && { color }]}>
                {SIGNAL_META[key]?.label ?? key}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={[styles.controls, { paddingVertical: vGap }]}>
        <TouchableOpacity style={styles.pauseBtn} onPress={onTogglePause} hitSlop={HitSlop.default}>
          <Text style={styles.pauseBtnText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
        </TouchableOpacity>
        <View style={styles.windowRow}>
          {WINDOW_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.windowBtn, windowSecs === opt.value && styles.windowBtnActive]}
              onPress={() => {
                onSetWindow(opt.value)
              }}
              hitSlop={HitSlop.default}
            >
              <Text
                style={[
                  styles.windowBtnText,
                  windowSecs === opt.value && styles.windowBtnTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={{ marginLeft: 'auto' }}
          onPress={onClear}
          hitSlop={HitSlop.default}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartContainer} onLayout={onChartLayout}>
        {!chartData.hasData ? (
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
            {chartData.lines.map((line) =>
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
            {chartData.lines.map((line) => {
              const range = SIGNAL_RANGE[line.key]
              if (!range || line.latestValue === undefined) return null
              const norm = Math.max(
                0,
                Math.min(1, (line.latestValue - range.min) / (range.max - range.min))
              )
              const y = Math.max(10, Math.min(chartSize.height - 4, (1 - norm) * chartSize.height))
              return (
                <SvgText
                  key={line.key}
                  x={chartSize.width - 4}
                  y={y}
                  fill={line.color}
                  fontSize={9}
                  textAnchor="end"
                  fontWeight="600"
                >
                  {SIGNAL_META[line.key]?.label} {formatValue(line.key, line.latestValue)}
                </SvgText>
              )
            })}
          </Svg>
        )}
      </View>

      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowStart)}</Text>
        <Text style={styles.timeLabel}>
          {formatTime((chartData.windowStart + chartData.windowEnd) / 2)}
        </Text>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowEnd)}</Text>
      </View>

      {chartData.hasData && (
        <View style={[styles.valuesGrid, { paddingVertical: vGap + 2 }]}>
          {chartData.lines.map((line) => (
            <View key={line.key} style={styles.valueChip}>
              <Text style={[styles.valueKey, { color: line.color }]}>
                {SIGNAL_META[line.key]?.label ?? line.key}
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
  pillBar: { borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 46 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontSize: Typography.xs, color: Colors.textMuted },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  pauseBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseBtnText: { fontSize: Typography.xs, color: Colors.textDim },
  windowRow: { flexDirection: 'row', gap: 2 },
  windowBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  windowBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  windowBtnText: { fontSize: Typography.xs, color: Colors.textMuted },
  windowBtnTextActive: { color: Colors.accent, fontWeight: '700' },
  clearText: { fontSize: Typography.xs, color: Colors.textMuted },

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
  timeLabel: { fontSize: Typography.xxs, color: Colors.textMuted, fontVariant: ['tabular-nums'] },

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
  valueNum: { fontSize: 15, fontWeight: '700' },
})
