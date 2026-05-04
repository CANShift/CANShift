// DashTopBar.tsx — Shared top bar for Dash and Graph tabs

import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import * as BleService from '../services/ble.service'
import * as SimService from '../services/sim.service'
import type { RootStackParamList } from '../navigation'

type RootNav = NativeStackNavigationProp<RootStackParamList>

export default function DashTopBar() {
  const { deviceName, firmwareVersion, canHealthy } = useDeviceStore()
  const { isLive } = useSignalsStore()
  const isSim = SimService.isRunning()
  const [menuVisible, setMenuVisible] = useState(false)

  // Tab navigation lives here; parent is the root stack
  const tabNav = useNavigation()
  const rootNav = tabNav.getParent<RootNav>()

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
          rootNav?.replace('Scan')
        },
      },
    ])
  }, [rootNav])

  return (
    <>
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
                rootNav?.navigate('Settings')
              }}
            >
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                rootNav?.navigate('Update')
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
    </>
  )
}

const styles = StyleSheet.create({
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
