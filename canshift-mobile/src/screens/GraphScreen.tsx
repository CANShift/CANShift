// GraphScreen.tsx — Real-time telemetry graph (MTune-style)
// Portrait: tabbed chart. Landscape: full-screen modal (auto, no button needed).

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  Modal,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { getBuffer, clearBuffer } from '../stores/telemetry.store'
import { SIGNAL_META } from '../constants/ble'

// ---------------------------------------------------------------------------
// Signal config
// ---------------------------------------------------------------------------

const SIGNAL_COLOR: Record<string, string> = {
  r:   '#FF8C00',
  lam: '#55CC55',
  tps: '#FFD700',
  map: '#44AAFF',
  bst: '#44CCFF',
  s:   '#CCCCCC',
  ct:  '#FF4444',
  ot:  '#FF6633',
  op:  '#BB88FF',
  iat: '#88BBFF',
  fp:  '#FF88BB',
  g:   '#888888',
  bat: '#AAFFAA',
}

const SIGNAL_RANGE: Record<string, { min: number; max: number }> = {
  r:   { min: 0,    max: 8000 },
  tps: { min: 0,    max: 100  },
  map: { min: 0,    max: 300  },
  bst: { min: -0.5, max: 2.5  },
  iat: { min: -20,  max: 80   },
  ct:  { min: 20,   max: 130  },
  ot:  { min: 20,   max: 150  },
  op:  { min: 0,    max: 10   },
  fp:  { min: 0,    max: 10   },
  lam: { min: 0.6,  max: 1.4  },
  s:   { min: 0,    max: 250  },
  g:   { min: 0,    max: 6    },
  bat: { min: 10,   max: 16   },
}

const WINDOW_OPTIONS = [
  { label: '30s', value: 30  },
  { label: '1m',  value: 60  },
  { label: '2m',  value: 120 },
]

const DEFAULT_SIGNALS = ['r', 'lam']
const ALL_SIGNALS = Object.keys(SIGNAL_META)

// ---------------------------------------------------------------------------
// Chart math helpers
// ---------------------------------------------------------------------------

function buildPoints(
  buffer: ReturnType<typeof getBuffer>,
  key: string,
  windowStart: number,
  windowEnd: number,
  w: number,
  h: number,
): string {
  const range = SIGNAL_RANGE[key]
  if (!range) return ''
  const span = windowEnd - windowStart
  const valueSpan = range.max - range.min
  const pts: string[] = []
  for (const s of buffer) {
    if (s.t < windowStart || s.v[key] === undefined) continue
    const x = ((s.t - windowStart) / span) * w
    const norm = Math.max(0, Math.min(1, (s.v[key] - range.min) / valueSpan))
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
    ? `${Math.round(val)}${meta.unit}`
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
  const [tick, setTick] = useState(0)
  const [chartSize, setChartSize] = useState({ width: 300, height: 160 })

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setTick((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [paused])

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setChartSize({ width, height })
  }, [])

  const chartData = useMemo(() => {
    const now = paused ? pausedAt : Date.now()
    const windowStart = now - windowSecs * 1000
    const buf = getBuffer().filter((s) => s.t >= windowStart)
    const latest = buf.length > 0 ? buf[buf.length - 1].v : {}
    const lines = visibleSignals.map((key) => ({
      key,
      color: SIGNAL_COLOR[key] ?? '#888',
      points: buildPoints(buf, key, windowStart, now, chartSize.width, chartSize.height),
      latestValue: latest[key],
    }))
    return {
      lines,
      windowStart: now - windowSecs * 1000,
      windowEnd: now,
      hasData: buf.length > 1,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, visibleSignals, windowSecs, paused, pausedAt, chartSize])

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
          const color = SIGNAL_COLOR[key] ?? '#888'
          return (
            <TouchableOpacity
              key={key}
              style={[styles.pill, active && { borderColor: color, backgroundColor: `${color}22` }]}
              onPress={() => onToggleSignal(key)}
            >
              <View style={[styles.pillDot, { backgroundColor: active ? color : Colors.textMuted }]} />
              <Text style={[styles.pillLabel, active && { color }]}>
                {SIGNAL_META[key]?.label ?? key}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Controls */}
      <View style={[styles.controls, { paddingVertical: vGap }]}>
        <TouchableOpacity style={styles.pauseBtn} onPress={onTogglePause}>
          <Text style={styles.pauseBtnText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
        </TouchableOpacity>
        <View style={styles.windowRow}>
          {WINDOW_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.windowBtn, windowSecs === opt.value && styles.windowBtnActive]}
              onPress={() => onSetWindow(opt.value)}
            >
              <Text style={[styles.windowBtnText, windowSecs === opt.value && styles.windowBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={onClear}>
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
                x1={0} y1={chartSize.height * f}
                x2={chartSize.width} y2={chartSize.height * f}
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
              const norm = Math.max(0, Math.min(1, (line.latestValue - range.min) / (range.max - range.min)))
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

      {/* Time axis */}
      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowStart)}</Text>
        <Text style={styles.timeLabel}>{formatTime((chartData.windowStart + chartData.windowEnd) / 2)}</Text>
        <Text style={styles.timeLabel}>{formatTime(chartData.windowEnd)}</Text>
      </View>

      {/* Live values strip */}
      {chartData.hasData && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.valuesStrip, { paddingVertical: vGap + 2 }]}
        >
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
        </ScrollView>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Screen — portrait + auto landscape modal
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

  if (isLandscape) {
    return (
      <Modal visible animationType="none" statusBarTranslucent supportedOrientations={['landscape']}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
          <ChartPanel {...panelProps} />
        </SafeAreaView>
      </Modal>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
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
  timeLabel: { fontSize: 9, color: Colors.textMuted, fontVariant: ['tabular-nums'] },

  valuesStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  valueChip: { alignItems: 'center' },
  valueKey: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  valueNum: { fontSize: Typography.sm, fontWeight: '700' },
})
