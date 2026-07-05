import React from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing } from '../theme'
import { useSignalValue, useSignalsIsLive } from '../stores/signals.store'
import { useDeviceStore } from '../stores/device.store'
import { SIGNAL_META, type SignalMeta, type SignalKey } from '../constants/ble'
import {
  GaugeWidget,
  GearWidget,
  LabelWidget,
  TimerWidget,
  WarningWidget,
} from '../components/widgets'
import DashTopBar from '../components/DashTopBar'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

const PRIMARY_SIGNALS: SignalKey[] = ['r', 's', 'g']
const GRID_SIGNALS: SignalKey[] = ['ct', 'ot', 'op', 'tps', 'lam', 'bat', 'bst', 'iat']
const SAFETY_SIGNALS: SignalKey[] = ['op', 'ct']

const GAUGE_SIZE_PORTRAIT = 132
const GAUGE_SIZE_LANDSCAPE = 116
const GRID_CELL_HEIGHT = 88
const GRID_CELL_HEIGHT_LANDSCAPE = 82
const GRID_CELL_WIDTH_LANDSCAPE = 150
const PORTRAIT_GRID_COLUMNS = 2
const WARNING_CELL_SIZE = 48
const TIMER_WIDTH = 132
const TIMER_HEIGHT = 56

const PrimaryGauge = ({
  signalKey,
  meta,
  size,
  dayMode,
}: {
  signalKey: SignalKey
  meta: SignalMeta
  size: number
  dayMode: boolean
}) => {
  const value = useSignalValue(signalKey)
  const isLive = useSignalsIsLive()
  const liveValue = isLive ? value : undefined
  return (
    <View style={styles.primaryCard}>
      <Text style={styles.primaryLabel}>{meta.label.toUpperCase()}</Text>
      {signalKey === 'g' ? (
        <GearWidget signalKey={signalKey} value={liveValue} size={size} dayMode={dayMode} />
      ) : (
        <GaugeWidget signalKey={signalKey} value={liveValue} size={size} dayMode={dayMode} />
      )}
    </View>
  )
}

const WarningCell = ({ signalKey, dayMode }: { signalKey: SignalKey; dayMode: boolean }) => {
  const value = useSignalValue(signalKey)
  const isLive = useSignalsIsLive()
  return (
    <WarningWidget
      signalKey={signalKey}
      value={isLive ? value : undefined}
      size={WARNING_CELL_SIZE}
      dayMode={dayMode}
    />
  )
}

const WarningStrip = ({ dayMode }: { dayMode: boolean }) => (
  <View style={styles.warningStrip}>
    {SAFETY_SIGNALS.map((key) => (
      <WarningCell key={key} signalKey={key} dayMode={dayMode} />
    ))}
  </View>
)

const GridLabel = ({
  signalKey,
  width,
  height,
  dayMode,
}: {
  signalKey: SignalKey
  width: number
  height: number
  dayMode: boolean
}) => {
  const value = useSignalValue(signalKey)
  const isLive = useSignalsIsLive()
  return (
    <LabelWidget
      signalKey={signalKey}
      value={isLive ? value : undefined}
      width={width}
      height={height}
      dayMode={dayMode}
    />
  )
}

export default function DashScreen(_: Props) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const dayMode = useDeviceStore((s) => s.isDayMode) === true

  const portraitCellWidth = Math.floor(
    (width - Spacing.lg * 2 - Spacing.sm * (PORTRAIT_GRID_COLUMNS - 1)) / PORTRAIT_GRID_COLUMNS
  )

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />

      {isLandscape ? (
        <View style={styles.landscapeBody}>
          <View style={styles.landscapePrimaryRow}>
            {PRIMARY_SIGNALS.map((key) => (
              <PrimaryGauge
                key={key}
                signalKey={key}
                meta={SIGNAL_META[key]}
                size={GAUGE_SIZE_LANDSCAPE}
                dayMode={dayMode}
              />
            ))}
            <TimerWidget width={TIMER_WIDTH} height={TIMER_HEIGHT} dayMode={dayMode} />
          </View>
          <ScrollView
            style={styles.landscapeRight}
            contentContainerStyle={styles.landscapeGrid}
            showsVerticalScrollIndicator={false}
          >
            {GRID_SIGNALS.map((key) => (
              <GridLabel
                key={key}
                signalKey={key}
                width={GRID_CELL_WIDTH_LANDSCAPE}
                height={GRID_CELL_HEIGHT_LANDSCAPE}
                dayMode={dayMode}
              />
            ))}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.primaryRow}>
            {PRIMARY_SIGNALS.map((key) => (
              <PrimaryGauge
                key={key}
                signalKey={key}
                meta={SIGNAL_META[key]}
                size={GAUGE_SIZE_PORTRAIT}
                dayMode={dayMode}
              />
            ))}
          </View>
          <View style={styles.grid}>
            {GRID_SIGNALS.map((key) => (
              <GridLabel
                key={key}
                signalKey={key}
                width={portraitCellWidth}
                height={GRID_CELL_HEIGHT}
                dayMode={dayMode}
              />
            ))}
          </View>
          <View style={styles.footerRow}>
            <TimerWidget width={TIMER_WIDTH} height={TIMER_HEIGHT} dayMode={dayMode} />
            <WarningStrip dayMode={dayMode} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  primaryRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'space-between' },
  primaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  warningStrip: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  landscapeBody: { flex: 1, flexDirection: 'column' },
  landscapePrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  landscapeRight: { flex: 1 },
  landscapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
})
