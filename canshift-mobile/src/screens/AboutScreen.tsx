import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import { readAppVersion } from '../lib/expo-version'
import { ScreenHeader } from '../components/ScreenHeader'
import { InfoRow } from '../components/InfoRow'
import { useDeviceStore } from '../stores/device.store'
import type { ConnectionState } from '../stores/device.store'
import { Colors, Radius, Spacing, Typography } from '../theme'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'About'>
}

const EM_DASH = '—'
const NOT_CONNECTED = 'Not connected'

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: 'Disconnected',
  scanning: 'Scanning',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
}

export default function AboutScreen({ navigation }: Props) {
  const connectionState = useDeviceStore((s) => s.connectionState)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const deviceName = useDeviceStore((s) => s.deviceName)
  const deviceId = useDeviceStore((s) => s.deviceId)

  const appVersion = readAppVersion()
  const connected = connectionState === 'connected'
  const firmwareValue = connected
    ? firmwareVersion !== null
      ? `v${firmwareVersion}`
      : EM_DASH
    : NOT_CONNECTED

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="ABOUT"
        onBack={() => {
          navigation.goBack()
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Application</Text>
          <InfoRow
            label="Mobile app version"
            value={appVersion !== null ? `v${appVersion}` : EM_DASH}
            muted={appVersion === null}
          />
          <InfoRow label="Config schema version" value={`v${CURRENT_SCHEMA_VERSION}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dashboard</Text>
          <InfoRow
            label="Connection"
            value={CONNECTION_LABEL[connectionState]}
            muted={!connected}
          />
          <InfoRow
            label="Dash firmware version"
            value={firmwareValue}
            muted={!connected || firmwareVersion === null}
          />
          <InfoRow
            label="Device name"
            value={deviceName ?? NOT_CONNECTED}
            muted={deviceName === null}
          />
          <InfoRow label="Device ID" value={deviceId ?? EM_DASH} muted={deviceId === null} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: Colors.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
})
