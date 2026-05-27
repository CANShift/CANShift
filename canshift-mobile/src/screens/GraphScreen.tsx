// GraphScreen.tsx — Real-time telemetry graph (MTune-style)

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useGraphTick } from '../hooks/use-graph-tick'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../theme'
import { getSignalColor } from '../theme/signal-colors'
import { TelemetrySample, clearBuffer, getRange, getWriteIndex } from '../stores/telemetry.store'
import { SIGNAL_META } from '../constants/ble'
import DashTopBar from '../components/DashTopBar'
import { ingestIncremental } from './graph-buffer'

// ---------------------------------------------------------------------------
// Signal config — colors live in theme/signal-colors.ts and derive from
// canshift-core's SENSOR_DEFAULT_RAMPS (#907).
// ---------------------------------------------------------------------------

const SIGNAL_RANGE: Record<string, { min: number; max: number }> = {
  r: { min: 0, max: 8000 },
  tps: { min: 0, max: 100 },
  map: { min: 0, max: 300 },
  bst: { min: -0.5, max: 2.5 },
  iat: { min: -20, max: 80 },
  ct: { min: 20, max: 130 },
  ot: { min: 20, max: 150 },
  op: { min: 0, max: 10 },
  fp: { min: 0, max: 10 },
  lam: { min: 0.6, max: 1.4 },
  s: { min: 0, max: 250 },
  g: { min: 0, max: 6 },
  bat: { min: 10, max: 16 },
}

const WINDOW_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
]

const DEFAULT_SIGNALS = ['r', 'lam']
const ALL_SIGNALS = Object.keys(SIGNAL_META)

// ---------------------------------------------------------------------------
// Chart math helpers
// ---------------------------------------------------------------------------

function buildPoints(
  buffer: readonly TelemetrySample[],
  key: string,
  windowStart: number,
  windowEnd: number,
  w: number,
  h: number
): string {
  const range = SIGNAL_RANGE[key]
  if (!range) return ''
  const span = windowEnd - windowStart
  const valueSpan = range.max - range.min
  const pts: string[] = []
  for (const s of buffer) {
    if (s.t < windowStart) continue
    const value = s.v[key]
    if (value === undefined || !Number.isFinite(value)) continue
    const x = ((s.t - windowStart) / span) * w
    const norm = Math.max(0, Math.min(1, (value - range.min) / valueSpan))
    pts.push(`${x.toFixed(1)},${((1 - norm) * h).toFixed(1)}`)
  }
  return pts.join(' ')
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

function formatValue(key: string, val: number | undefined): string {
  if (val === undefined) return '—'
  const meta = SIGNAL_META[key]
  if (!meta) return val.toString()
  return meta.decimals === 0
    ? `${String(Math.round(val))}${meta.unit}`
    : `${val.toFixed(meta.decimals)}${meta.unit}`
}

// ---------------------------------------------------------------------------
// Inner chart panel — shared between portrait and landscape
// ---------------------------------------------------------------------------

interface ChartPanelProps {
  visibleSignals: string[]
  windowSecs: number
  paused: boolean
  pausedAt: number
  onTogglePause: () => void
  onSetWindow: (s: number) => void
  onClear: () => void
  onToggleSignal: (key: string) => void
  compact: boolean // true in landscape → tighter spacing
}

function ChartPanel({
  visibleSignals,
  windowSecs,
  paused,
  pausedAt,
  onTogglePause,
  onSetWindow,
  onClear,
  onToggleSignal,
  compact,
}: ChartPanelProps) {
  const [chartSize, setChartSize] = useState({ width: 300, height: 160 })
  const tick = useGraphTick(paused)

  // Stable rolling buffer — append new samples each tick, drop ones outside the
  // current time window. Avoids re-copying the full 3000-entry ring buffer at
  // 10 Hz (closes #684).
  const rollingRef = useRef<TelemetrySample[]>([])
  const lastSeenIndexRef = useRef<number>(0)

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setChartSize({ width, height })
  }, [])

  const chartData = useMemo(() => {
    const now = paused ? pausedAt : Date.now()
    const windowStart = now - windowSecs * 1000

    // Incremental ingest: pull only samples added since the last tick.
    const currentWriteIndex = getWriteIndex()
    if (currentWriteIndex < lastSeenIndexRef.current) {
      // Buffer was cleared — reset local state.
      rollingRef.current = []
      lastSeenIndexRef.current = 0
    }
    const fresh =
      currentWriteIndex > lastSeenIndexRef.current
        ? getRange(lastSeenIndexRef.current, currentWriteIndex)
        : []
    lastSeenIndexRef.current = currentWriteIndex

    // Trim head — drop samples outside the visible time window.
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

  // Repopulate the rolling buffer when the time window grows — older samples
  // that were trimmed for a 30s view must be re-pulled for a 2m view. We
  // re-seed from the ring buffer (which retains the full MAX_SAMPLES history)
  // and resync the lastSeen cursor.
  useEffect(() => {
    const writeIdx = getWriteIndex()
    const fromIdx = Math.max(0, writeIdx - 3000)
    rollingRef.current = [...getRange(fromIdx, writeIdx)]
    lastSeenIndexRef.current = writeIdx
  }, [windowSecs])

  const vGap = compact ? 2 : Spacing.xs

  return (
    <>
      {/* Signal pills */}
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

      {/* Controls */}
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

      {/* Chart */}
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
            {/* Value labels at right edge, Y-positioned by signal value */}
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
                  // react-native-svg ships its x/y SVG positioning props with
                  // a `@deprecated` JSDoc tag that actually targets the
                  // (long-gone) transform `x`/`y` shorthand, not the SVG
                  // positioning attributes. These attributes are the
                  // documented SVG API and have no replacement — ignoring the
                  // false positive here.
                  // eslint-disable-next-line @typescript-eslint/no-deprecated
                  x={chartSize.width - 4}
                  // eslint-disable-next-line @typescript-eslint/no-deprecated
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

      {/* Time axis */}
      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowStart)}</Text>
        <Text style={styles.timeLabel}>
          {formatTime((chartData.windowStart + chartData.windowEnd) / 2)}
        </Text>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowEnd)}</Text>
      </View>

      {/* Live values grid — 2 rows, fixed-width cells */}
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

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GraphScreen() {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const [windowSecs, setWindowSecs] = useState(30)
  const [visibleSignals, setVisibleSignals] = useState<string[]>(DEFAULT_SIGNALS)

  const handleTogglePause = useCallback(() => {
    setPaused((p) => {
      if (!p) setPausedAt(Date.now())
      return !p
    })
  }, [])

  const handleToggleSignal = useCallback((key: string) => {
    setVisibleSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const panelProps: ChartPanelProps = {
    visibleSignals,
    windowSecs,
    paused,
    pausedAt,
    onTogglePause: handleTogglePause,
    onSetWindow: setWindowSecs,
    onClear: clearBuffer,
    onToggleSignal: handleToggleSignal,
    compact: isLandscape,
  }

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />
      <ChartPanel {...panelProps} />
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

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
    backgroundColor: '#080808',
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
