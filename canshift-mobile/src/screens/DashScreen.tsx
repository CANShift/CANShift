// DashScreen.tsx — Live dashboard via BLE telemetry

import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import { SIGNAL_META } from '../constants/ble'
import SignalCard from '../components/SignalCard'
import * as BleService from '../services/ble.service'
import * as SimService from '../services/sim.service'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

const PRIMARY_SIGNALS = ['r', 's', 'g']
const GRID_SIGNALS = ['ct', 'ot', 'op', 'tps', 'lam', 'bat', 'bst', 'iat']

export default function DashScreen({ navigation }: Props) {
  const { deviceName, firmwareVersion, canHealthy } = useDeviceStore()
  const isSim = SimService.isRunning()
  const { values, isLive } = useSignalsStore()
  const [menuVisible, setMenuVisible] = useState(false)

  const handleDisconnect = useCallback(() => {
    Alert.alert('Disconnect', 'Disconnect from the dashboard?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          if (SimService.isRunning()) {
            SimService.stop()
          } else {
            await BleService.disconnect()
          }
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
          {isSim && (
            <View style={styles.simBadge}>
              <Text style={styles.simText}>SIM</Text>
            </View>
          )}
          {!isLive && !isSim && (
            <View style={styles.staleBadge}>
              <Text style={styles.staleText}>NO DATA</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDisconnect} style={styles.iconBtn}>
            <Text style={[styles.iconBtnText, { color: Colors.accent }]}>⏻</Text>
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

      {/* Burger menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                navigation.navigate('Settings')
              }}
            >
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                navigation.navigate('Update')
              }}
            >
              <Text style={styles.menuItemText}>Firmware Update</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Text style={[styles.menuItemText, { color: Colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  simBadge: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#4a4aff',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  simText: { fontSize: Typography.xs, color: '#7a7aff', fontWeight: '700' },
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
  dim: { color: Colors.textMuted },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: Spacing.xl,
  },
  menuItem: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  menuItemText: { fontSize: Typography.md, color: Colors.text },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
})
