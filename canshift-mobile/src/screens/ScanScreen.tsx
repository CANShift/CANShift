// ScanScreen.tsx — BLE device scan and connect

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import * as BleService from '../services/ble.service'
import * as SimService from '../services/sim.service'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scan'>
}

type FoundDevice = { id: string; name: string }

export default function ScanScreen({ navigation }: Props) {
  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<FoundDevice[]>([])
  const connectionState = useDeviceStore((s) => s.connectionState)

  const startScan = useCallback(async () => {
    const ready = await BleService.isBlePowered()
    if (!ready) {
      Alert.alert('Bluetooth', 'Please enable Bluetooth and try again.')
      return
    }
    setDevices([])
    setScanning(true)
    await BleService.scan((device) => {
      setDevices((prev) =>
        prev.find((d) => d.id === device.id) ? prev : [...prev, device]
      )
    }, 10000)
    setScanning(false)
  }, [])

  const connectTo = useCallback(
    async (device: FoundDevice) => {
      BleService.stopScan()
      setScanning(false)
      try {
        await BleService.connect(device.id)
        navigation.replace('Connected')
      } catch (err) {
        Alert.alert('Connection failed', err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [navigation]
  )

  const startDemo = useCallback(() => {
    SimService.start()
    navigation.replace('Connected')
  }, [navigation])

  return (
    <SafeAreaView style={styles.container}>
      {/* Centered main content */}
      <View style={styles.center}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>CANShift</Text>
        <Text style={styles.subtitle}>Connect to your dashboard</Text>

        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnActive]}
          onPress={startScan}
          disabled={scanning || connectionState === 'connecting'}
        >
          {scanning ? (
            <ActivityIndicator color={Colors.accent} size="small" />
          ) : (
            <Text style={styles.scanBtnText}>
              {devices.length > 0 ? 'Scan again' : 'Scan for devices'}
            </Text>
          )}
        </TouchableOpacity>

        {scanning && <Text style={styles.scanHint}>Searching for CANShift devices…</Text>}

        {/* Device list — only rendered when results exist */}
        {devices.length > 0 && (
          <View style={styles.listWrapper}>
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              contentContainerStyle={styles.list}
              scrollEnabled={devices.length > 3}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceRow}
                  onPress={() => void connectTo(item)}
                  disabled={connectionState === 'connecting'}
                >
                  <View style={styles.deviceDot} />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.deviceId}>{item.id}</Text>
                  </View>
                  {connectionState === 'connecting' ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : (
                    <Text style={styles.arrow}>›</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Demo mode — pinned to bottom */}
      <TouchableOpacity style={styles.demoBtn} onPress={startDemo}>
        <Text style={styles.demoBtnText}>Demo mode</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 22,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  scanBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  scanBtnActive: { borderColor: Colors.accent },
  scanBtnText: { fontSize: Typography.md, color: Colors.text },
  scanHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  listWrapper: {
    width: '100%',
    maxHeight: 220,
    marginTop: Spacing.lg,
  },
  list: { gap: Spacing.sm },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: Typography.md, color: Colors.text, fontWeight: '600' },
  deviceId: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  arrow: { fontSize: Typography.xl, color: Colors.textMuted },
  demoBtn: { paddingVertical: Spacing.lg, alignItems: 'center' },
  demoBtnText: { fontSize: Typography.sm, color: Colors.textDim },
})
