// DashScreen.tsx — Live dashboard via BLE telemetry

import React from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useSignalsStore } from '../stores/signals.store'
import { SIGNAL_META } from '../constants/ble'
import SignalCard from '../components/SignalCard'
import DashTopBar from '../components/DashTopBar'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

const PRIMARY_SIGNALS = ['r', 's', 'g']
const GRID_SIGNALS = ['ct', 'ot', 'op', 'tps', 'lam', 'bat', 'bst', 'iat']

export default function DashScreen(_: Props) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const { values, isLive } = useSignalsStore()

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />

      {isLandscape ? (
        // Landscape: primary signals stacked on left, grid scrolls on right
        <View style={styles.landscapeBody}>
          <View style={styles.landscapeLeft}>
            {PRIMARY_SIGNALS.map((key) => {
              const meta = SIGNAL_META[key]
              if (!meta) return null
              return (
                <View key={key} style={styles.primaryCardLandscape}>
                  <Text style={styles.primaryLabelLandscape}>{meta.label.toUpperCase()}</Text>
                  <Text style={[styles.primaryValueLandscape, !isLive && styles.dim]}>
                    {values[key] !== undefined
                      ? meta.decimals === 0
                        ? Math.round(values[key]!).toString()
                        : values[key]!.toFixed(meta.decimals)
                      : '---'}
                  </Text>
                  {meta.unit ? <Text style={styles.primaryUnitLandscape}>{meta.unit}</Text> : null}
                </View>
              )
            })}
          </View>
          <ScrollView
            style={styles.landscapeRight}
            contentContainerStyle={styles.landscapeGrid}
            showsVerticalScrollIndicator={false}
          >
            {GRID_SIGNALS.map((key) => {
              const meta = SIGNAL_META[key]
              if (!meta) return null
              return (
                <SignalCard
                  key={key}
                  meta={meta}
                  value={isLive ? values[key] : undefined}
                  compact
                />
              )
            })}
          </ScrollView>
        </View>
      ) : (
        // Portrait: stacked scroll layout
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.primaryRow}>
            {PRIMARY_SIGNALS.map((key) => {
              const meta = SIGNAL_META[key]
              if (!meta) return null
              return (
                <View key={key} style={styles.primaryCard}>
                  <Text style={styles.primaryLabel}>{meta.label.toUpperCase()}</Text>
                  <Text style={[styles.primaryValue, !isLive && styles.dim]}>
                    {values[key] !== undefined
                      ? meta.decimals === 0
                        ? Math.round(values[key]!).toString()
                        : values[key]!.toFixed(meta.decimals)
                      : '---'}
                  </Text>
                  {meta.unit ? <Text style={styles.primaryUnit}>{meta.unit}</Text> : null}
                </View>
              )
            })}
          </View>
          <View style={styles.grid}>
            {GRID_SIGNALS.map((key) => {
              const meta = SIGNAL_META[key]
              if (!meta) return null
              return (
                <SignalCard
                  key={key}
                  meta={meta}
                  value={isLive ? values[key] : undefined}
                  compact
                />
              )
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  // Portrait primary cards
  primaryRow: { flexDirection: 'row', gap: Spacing.md },
  primaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  primaryValue: { fontSize: Typography.xxl, fontWeight: '700', color: Colors.text },
  primaryUnit: { fontSize: Typography.sm, color: Colors.textDim, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  // Landscape layout
  landscapeBody: { flex: 1, flexDirection: 'row' },
  landscapeLeft: {
    width: 160,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    justifyContent: 'space-evenly',
  },
  primaryCardLandscape: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  primaryLabelLandscape: { fontSize: 9, color: Colors.textMuted, letterSpacing: 0.8 },
  primaryValueLandscape: { fontSize: Typography.xl, fontWeight: '700', color: Colors.text },
  primaryUnitLandscape: { fontSize: 10, color: Colors.textDim },
  landscapeRight: { flex: 1 },
  landscapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  dim: { color: Colors.textMuted },
})
