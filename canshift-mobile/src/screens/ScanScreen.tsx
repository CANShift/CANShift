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
import { ChevronRight } from 'lucide-react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import * as BleService from '../services/ble.service'
import type { BlePermissionState } from '../services/ble.service'
import { mapBleError } from '../services/ble.errors'
import { bleErrorMessage } from '../services/ble-error-message'
import * as SimService from '../services/sim.service'
import type { RootStackParamList } from '../navigation'
import {
  BlePermissionDialog,
  type BlePermissionPlatform,
} from '../components/ble-permission-dialog'
import { Card } from '../components/ui'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scan'>
}

interface FoundDevice {
  id: string
  name: string
}

interface DeviceRowProps {
  device: FoundDevice
  connecting: boolean
  disabled: boolean
  onPress: (device: FoundDevice) => void
}

const DeviceRow = React.memo(({ device, connecting, disabled, onPress }: DeviceRowProps) => (
  <TouchableOpacity
    onPress={() => {
      onPress(device)
    }}
    disabled={connecting || disabled}
    accessibilityRole="button"
    accessibilityLabel={`Connect to ${device.name}`}
    accessibilityState={{ disabled: connecting || disabled }}
  >
    <Card className="flex-row items-center gap-3">
      <View style={styles.deviceDot} />
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.deviceId}>{device.id}</Text>
      </View>
      {connecting ? (
        <ActivityIndicator color={Colors.accent} size="small" />
      ) : (
        <ChevronRight size={18} color={Colors.textMuted} />
      )}
    </Card>
  </TouchableOpacity>
))
DeviceRow.displayName = 'DeviceRow'

export default function ScanScreen({ navigation }: Props) {
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [devices, setDevices] = useState<FoundDevice[]>([])
  const [unauthorizedPlatform, setUnauthorizedPlatform] = useState<BlePermissionPlatform | null>(
    null
  )
  const connectionState = useDeviceStore((s) => s.connectionState)
  const isReconnecting = useReconnectStore((s) => s.isReconnecting)
  const reconnectAttempt = useReconnectStore((s) => s.attempt)
  const reconnectMaxAttempts = useReconnectStore((s) => s.maxAttempts)

  const promptUnauthorized = useCallback((platform: BlePermissionPlatform): void => {
    setUnauthorizedPlatform(platform)
  }, [])

  const promptForBleState = useCallback(
    (state: Exclude<BlePermissionState, { kind: 'ok' }>): void => {
      switch (state.kind) {
        case 'powered_off':
          Alert.alert('Bluetooth is off', 'Turn Bluetooth on to scan for your dashboard.')
          return
        case 'unauthorized':
          promptUnauthorized(state.platform)
          return
        case 'unsupported':
          Alert.alert('Bluetooth unavailable', "This device doesn't support Bluetooth Low Energy.")
          return
        case 'resetting':
          Alert.alert('Bluetooth restarting', 'Bluetooth is resetting. Try again in a moment.')
          return
        case 'unknown':
          Alert.alert(
            'Checking Bluetooth',
            'Bluetooth state is not yet available. Try again in a moment.'
          )
          return
        default: {
          const _exhaustive: never = state
          void _exhaustive
          return
        }
      }
    },
    [promptUnauthorized]
  )

  const startScan = useCallback(async () => {
    const state = await BleService.getBlePermissionState()
    if (state.kind !== 'ok') {
      promptForBleState(state)
      return
    }
    setDevices([])
    setScanning(true)
    try {
      await BleService.scan((device) => {
        setDevices((prev) => (prev.find((d) => d.id === device.id) ? prev : [...prev, device]))
      }, 10000)
      setHasScanned(true)
    } catch (err) {
      const mapped = mapBleError(err)
      if (mapped.kind === 'permission-denied') {
        promptUnauthorized(mapped.platform)
      } else {
        const { title, body } = bleErrorMessage(mapped)
        Alert.alert(title, body)
      }
    } finally {
      setScanning(false)
    }
  }, [promptForBleState, promptUnauthorized])

  const stopScan = useCallback(() => {
    BleService.stopScan()
  }, [])

  const cancelReconnect = useCallback(() => {
    BleService.cancelReconnect()
  }, [])

  const connectTo = useCallback(
    async (device: FoundDevice) => {
      BleService.stopScan()
      setConnectingId(device.id)
      try {
        await BleService.connect(device.id)
        navigation.replace('Connected')
      } catch (err) {
        const mapped = mapBleError(err)
        if (mapped.kind === 'permission-denied') {
          promptUnauthorized(mapped.platform)
          return
        }
        const { title, body } = bleErrorMessage(mapped)
        Alert.alert(title, body)
      } finally {
        setConnectingId(null)
      }
    },
    [navigation, promptUnauthorized]
  )

  const startDemo = useCallback(() => {
    SimService.start()
    navigation.replace('Connected')
  }, [navigation])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={() => {
            navigation.navigate('About')
          }}
          accessibilityRole="button"
          accessibilityLabel="About"
        >
          <Text style={styles.infoBtnText}>ⓘ</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.center}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Connect to your dashboard</Text>

        {isReconnecting && (
          <Card
            variant="accent"
            padding="none"
            className="w-full flex-row items-center gap-2 mb-3 px-3 py-2"
          >
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.reconnectText}>
              {`Reconnecting to dashboard… (${String(reconnectAttempt)}/${String(reconnectMaxAttempts)})`}
            </Text>
            <TouchableOpacity
              onPress={cancelReconnect}
              hitSlop={HitSlop.default}
              accessibilityRole="button"
              accessibilityLabel="Cancel reconnecting"
            >
              <Text style={styles.reconnectCancel}>Cancel</Text>
            </TouchableOpacity>
          </Card>
        )}

        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnActive]}
          onPress={scanning ? stopScan : startScan}
          disabled={connectionState === 'connecting'}
          accessibilityRole="button"
          accessibilityLabel={
            scanning ? 'Stop scanning' : hasScanned ? 'Scan again' : 'Scan for devices'
          }
          accessibilityState={{ disabled: connectionState === 'connecting' }}
        >
          {scanning ? (
            <View style={styles.scanBtnRow}>
              <ActivityIndicator color={Colors.accent} size="small" />
              <Text style={styles.scanBtnText}>Stop scanning</Text>
            </View>
          ) : (
            <Text style={styles.scanBtnText}>{hasScanned ? 'Scan again' : 'Scan for devices'}</Text>
          )}
        </TouchableOpacity>

        {scanning && <Text style={styles.scanHint}>Searching for CANShift devices…</Text>}

        {!scanning && hasScanned && devices.length === 0 && (
          <View
            style={styles.emptyState}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.emptyTitle}>No dashboards found</Text>
            <Text style={styles.emptyHint}>
              Make sure your dashboard is powered on and in range, then scan again.
            </Text>
          </View>
        )}

        {devices.length > 0 && (
          <View style={styles.listWrapper}>
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              contentContainerStyle={styles.list}
              scrollEnabled={devices.length > 3}
              renderItem={({ item }) => (
                <DeviceRow
                  device={item}
                  connecting={connectingId === item.id}
                  disabled={connectingId !== null && connectingId !== item.id}
                  onPress={connectTo}
                />
              )}
            />
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.demoBtn} onPress={startDemo} accessibilityRole="button">
        <Text style={styles.demoBtnText}>Demo mode</Text>
      </TouchableOpacity>

      <BlePermissionDialog
        platform={unauthorizedPlatform}
        onDismiss={() => {
          setUnauthorizedPlatform(null)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  infoBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: { fontSize: Typography.lg, color: Colors.textDim },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '75%',
    height: 120,
    marginBottom: Spacing.sm,
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
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnActive: { borderColor: Colors.accent },
  scanBtnText: { fontSize: Typography.md, color: Colors.text },
  scanBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reconnectText: {
    fontSize: Typography.sm,
    color: Colors.text,
    flex: 1,
  },
  reconnectCancel: { fontSize: Typography.sm, color: Colors.accent, fontWeight: '700' },
  scanHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyTitle: { fontSize: Typography.md, color: Colors.text, fontWeight: '600' },
  emptyHint: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  listWrapper: {
    width: '100%',
    maxHeight: 220,
    marginTop: Spacing.lg,
  },
  list: { gap: Spacing.sm },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: Typography.md, color: Colors.text, fontWeight: '600' },
  deviceId: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  demoBtn: { paddingVertical: Spacing.lg, alignItems: 'center' },
  demoBtnText: { fontSize: Typography.sm, color: Colors.textDim },
})
