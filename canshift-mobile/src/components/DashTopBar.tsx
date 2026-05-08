// DashTopBar.tsx — Shared top bar for Dash and Graph tabs

import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useShallow } from 'zustand/react/shallow'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import * as BleService from '../services/ble.service'
import * as SimService from '../services/sim.service'
import type { RootStackParamList } from '../navigation'
import { Sheet, SheetContent } from './ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

type RootNav = NativeStackNavigationProp<RootStackParamList>

export default function DashTopBar() {
  const { deviceName, firmwareVersion, canHealthy } = useDeviceStore(
    useShallow((s) => ({
      deviceName: s.deviceName,
      firmwareVersion: s.firmwareVersion,
      canHealthy: s.canHealthy,
    })),
  )
  const isLive = useSignalsStore((s) => s.isLive)
  const isSim = SimService.isRunning()
  const [menuVisible, setMenuVisible] = useState(false)
  const [disconnectVisible, setDisconnectVisible] = useState(false)

  // Tab navigation lives here; parent is the root stack
  const tabNav = useNavigation()
  const rootNav = tabNav.getParent<RootNav>()

  const handleDisconnect = useCallback(() => {
    setDisconnectVisible(true)
  }, [])

  const confirmDisconnect = useCallback(async () => {
    if (SimService.isRunning()) {
      SimService.stop()
    } else {
      await BleService.disconnect()
    }
    rootNav.replace('Scan')
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
          <TouchableOpacity onPress={() => { setMenuVisible(true); }} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDisconnect} style={styles.iconBtn}>
            <Text style={[styles.iconBtnText, { color: Colors.accent }]}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AlertDialog open={disconnectVisible} onOpenChange={setDisconnectVisible}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect</AlertDialogTitle>
            <AlertDialogDescription>Disconnect from the dashboard?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={() => void confirmDisconnect()}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={menuVisible} onOpenChange={setMenuVisible}>
        <SheetContent side="bottom" className="p-0">
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                rootNav.navigate('Settings')
              }}
            >
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false)
                rootNav.navigate('Update')
              }}
            >
              <Text style={styles.menuItemText}>Firmware Update</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); }}>
              <Text style={[styles.menuItemText, { color: Colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SheetContent>
      </Sheet>
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
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  simText: { fontSize: Typography.xs, color: Colors.accent, fontWeight: '700' },
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
  menuSheet: {
    backgroundColor: Colors.surfaceHigh,
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
