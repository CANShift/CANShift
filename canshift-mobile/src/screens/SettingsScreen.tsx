import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Spacing } from '../theme'
import { ScreenHeader } from '../components/ScreenHeader'
import { SegmentedControl } from '../components/SegmentedControl'
import { Section } from '@/components/ui'
import {
  useAppSettingsStore,
  TELEMETRY_BUFFER_OPTIONS,
  type AppTheme,
  type ReconnectBehavior,
  type TelemetryBufferSize,
  type Units,
} from '../stores/app-settings.store'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>
}

const THEME_OPTIONS: { label: string; value: AppTheme }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

const RECONNECT_OPTIONS: { label: string; value: ReconnectBehavior }[] = [
  { label: 'Automatic', value: 'auto' },
  { label: 'Off', value: 'off' },
]

const UNITS_OPTIONS: { label: string; value: Units }[] = [
  { label: 'Metric', value: 'metric' },
  { label: 'Imperial', value: 'imperial' },
]

const RELEASE_OPTIONS: { label: string; value: boolean }[] = [
  { label: 'Stable', value: false },
  { label: 'Pre-release', value: true },
]

const BUFFER_OPTIONS: { label: string; value: TelemetryBufferSize }[] =
  TELEMETRY_BUFFER_OPTIONS.map((value) => ({
    label: `${(value / 1000).toString()}k samples`,
    value,
  }))

export default function SettingsScreen({ navigation }: Props) {
  const theme = useAppSettingsStore((s) => s.theme)
  const telemetryBufferSize = useAppSettingsStore((s) => s.telemetryBufferSize)
  const reconnectBehavior = useAppSettingsStore((s) => s.reconnectBehavior)
  const showPreRelease = useAppSettingsStore((s) => s.showPreRelease)
  const units = useAppSettingsStore((s) => s.units)
  const setTheme = useAppSettingsStore((s) => s.setTheme)
  const setTelemetryBufferSize = useAppSettingsStore((s) => s.setTelemetryBufferSize)
  const setReconnectBehavior = useAppSettingsStore((s) => s.setReconnectBehavior)
  const setShowPreRelease = useAppSettingsStore((s) => s.setShowPreRelease)
  const setUnits = useAppSettingsStore((s) => s.setUnits)

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="SETTINGS"
        onBack={() => {
          navigation.goBack()
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="APPEARANCE">
          <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} />
        </Section>

        <Section title="TELEMETRY BUFFER">
          <SegmentedControl
            options={BUFFER_OPTIONS}
            value={telemetryBufferSize}
            onChange={setTelemetryBufferSize}
          />
        </Section>

        <Section title="RECONNECT">
          <SegmentedControl
            options={RECONNECT_OPTIONS}
            value={reconnectBehavior}
            onChange={setReconnectBehavior}
          />
        </Section>

        <Section title="RELEASE CHANNEL">
          <SegmentedControl
            options={RELEASE_OPTIONS}
            value={showPreRelease}
            onChange={setShowPreRelease}
          />
        </Section>

        <Section title="UNITS">
          <SegmentedControl options={UNITS_OPTIONS} value={units} onChange={setUnits} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.xl },
})
