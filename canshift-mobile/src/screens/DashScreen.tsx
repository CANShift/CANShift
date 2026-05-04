// DashScreen.tsx — Live dashboard via BLE telemetry

import React, { useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import { SIGNAL_META } from '../constants/ble'
import SignalCard from '../components/SignalCard'
import * as BleService from '../services/ble.service'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dash'>
}

// Signal display order — top (primary) then grid
const PRIMARY_SIGNALS = ['r', 's', 'g']
const GRID_SIGNALS = ['ct', 'ot', 'op', 'tps', 'lam', 'bat', 'bst', 'iat']

export default function DashScreen({ navigation }: Props) {
  const { deviceName, firmwareVersion, canHealthy } = useDeviceStore()
  const { values, isLive } = useSignalsStore()

  const handleDisconnect = useCallback(async () => {
    Alert.alert('Disconnect', 'Disconnect from the dashboard?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await BleService.disconnect()
          navigation.replace('Scan')
        },
      },
    ])
  }, [navigation])

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.deviceName}>{deviceName ?? 'CANShift'}</Text>
          <Text style={styles.version}>
            {firmwareVersion ? `v${firmwareVersion}` : ''}
            {' · '}
            <Text style={{ color: canHealthy ? Colors.success : Colors.textMuted }}>
              {canHealthy ? 'CAN ●' : 'CAN ○'}
            </Text>
          </Text>
        </View>
        <View style={styles.topBarRight}>
          {!isLive && (
            <View style={styles.staleBadge}>
              <Text style={styles.staleText}>NO DATA</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Update')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void handleDisconnect()} style={styles.iconBtn}>
            <Text style={[styles.iconBtnText, { color: Colors.accent }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Primary signals — large cards */}
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

        {/* Secondary signals — compact grid */}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deviceName: { fontSize: Typography.md, fontWeight: '600', color: Colors.text },
  version: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  staleBadge: {
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  staleText: { fontSize: Typography.xs, color: Colors.accent, fontWeight: '700' },
  iconBtn: { padding: Spacing.xs },
  iconBtnText: { fontSize: Typography.lg, color: Colors.textDim },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  primaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
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
  primaryValue: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  primaryUnit: {
    fontSize: Typography.sm,
    color: Colors.textDim,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dim: { color: Colors.textMuted },
})
