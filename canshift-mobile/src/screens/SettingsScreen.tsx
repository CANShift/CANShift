import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import Slider from '@react-native-community/slider'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import * as BleService from '../services/ble.service'
import { mapBleError } from '../services/ble.errors'
import { bleErrorMessage } from '../services/ble-error-message'
import { useDeviceStore } from '../stores/device.store'
import { log } from '../stores/log.store'
import type { RootStackParamList } from '../navigation'
import {
  BlePermissionDialog,
  type BlePermissionPlatform,
} from '../components/ble-permission-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Label,
  Section,
  Toast,
} from '@/components/ui'
import { ScreenHeader } from '../components/ScreenHeader'
import { SegmentedControl } from '../components/SegmentedControl'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>
}

const SLEEP_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
]

const THEME_OPTIONS: { label: string; value: boolean }[] = [
  { label: 'Night', value: false },
  { label: 'Day', value: true },
]

type LoadState = 'loading' | 'ready' | 'error'

export default function SettingsScreen({ navigation }: Props) {
  const isDayMode = useDeviceStore((s) => s.isDayMode)
  const [brightness, setBrightness] = useState(0)
  const [sleep, setSleep] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [dayNightPending, setDayNightPending] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrateConfirmOpen, setCalibrateConfirmOpen] = useState(false)
  const [unauthorizedPlatform, setUnauthorizedPlatform] = useState<BlePermissionPlatform | null>(
    null
  )

  const handleBleFailure = useCallback((err: unknown): void => {
    const mapped = mapBleError(err)
    if (mapped.kind === 'permission-denied') {
      setUnauthorizedPlatform(mapped.platform)
      return
    }
    const { title, body } = bleErrorMessage(mapped)
    Toast.show({ type: 'error', text1: title, text2: body })
  }, [])

  const loadSettings = useCallback(async () => {
    setLoadState('loading')
    try {
      const current = await BleService.readSettings()
      if (!current) {
        setLoadState('error')
        return
      }
      setBrightness(current.brightness)
      setSleep(current.sleep)
      setLoadState('ready')
    } catch (err) {
      log(
        'warn',
        `Failed to read settings from device: ${err instanceof Error ? err.message : String(err)}`
      )
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await BleService.pushSettings({ brightness, sleep })
      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: 'Settings applied to dashboard.',
      })
      navigation.goBack()
    } catch (err) {
      handleBleFailure(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSetDayNight = async (target: boolean) => {
    if (isDayMode === target || dayNightPending) return
    setDayNightPending(true)
    try {
      await BleService.sendCmd('set_day_night', { day: target })
      Toast.show({
        type: 'success',
        text1: target ? 'Day mode' : 'Night mode',
      })
    } catch (err) {
      handleBleFailure(err)
    } finally {
      setDayNightPending(false)
    }
  }

  const handleCalibrate = () => {
    setCalibrateConfirmOpen(true)
  }

  const startCalibration = async () => {
    setCalibrating(true)
    try {
      await BleService.sendCmd('start_calibration')
      Toast.show({
        type: 'success',
        text1: 'Calibration started',
        text2: 'Follow the crosshairs on your dashboard.',
      })
    } catch (err) {
      handleBleFailure(err)
    } finally {
      setCalibrating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="SCREEN SETTINGS"
        onBack={() => {
          navigation.goBack()
        }}
      />

      {loadState === 'loading' && (
        <View
          style={styles.statusContainer}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator color={Colors.accent} size="small" />
          <Text style={styles.statusText}>Reading settings from dashboard…</Text>
        </View>
      )}

      {loadState === 'error' && (
        <View
          style={styles.statusContainer}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.errorTitle}>Couldn’t read settings</Text>
          <Text style={styles.errorHint}>
            The dashboard didn’t return its current settings. Check the connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => void loadSettings()}
            accessibilityRole="button"
            accessibilityLabel="Retry reading settings"
          >
            <Text style={styles.actionBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadState === 'ready' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Section>
            <View style={styles.rowHeader}>
              <Label>BRIGHTNESS</Label>
              <Text style={styles.value}>{brightness}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={10}
              maximumValue={100}
              step={1}
              value={brightness}
              onValueChange={setBrightness}
              minimumTrackTintColor={Colors.accent}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.text}
            />
          </Section>

          <Section title="SLEEP">
            <SegmentedControl options={SLEEP_OPTIONS} value={sleep} onChange={setSleep} />
          </Section>

          <Section title="THEME">
            <SegmentedControl<boolean | null>
              options={THEME_OPTIONS}
              value={isDayMode}
              onChange={(v) => {
                if (v !== null) void handleSetDayNight(v)
              }}
              disabled={dayNightPending}
            />
          </Section>

          <Section title="TOUCH">
            <TouchableOpacity
              style={[styles.actionBtn, calibrating && styles.actionBtnDisabled]}
              onPress={handleCalibrate}
              disabled={calibrating}
              accessibilityRole="button"
              accessibilityState={{ disabled: calibrating }}
            >
              <Text style={styles.actionBtnText}>
                {calibrating ? 'Calibrating…' : 'Calibrate Touch Screen'}
              </Text>
            </TouchableOpacity>
          </Section>
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || loadState !== 'ready') && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving || loadState !== 'ready'}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || loadState !== 'ready' }}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>

      <AlertDialog open={calibrateConfirmOpen} onOpenChange={setCalibrateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Calibrate Touch</AlertDialogTitle>
            <AlertDialogDescription>
              The dashboard screen will display calibration crosshairs. Tap each point accurately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="default" onPress={() => void startCalibration()}>
              Start
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  container: { flex: 1, backgroundColor: Colors.bg },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  statusText: { fontSize: Typography.sm, color: Colors.textMuted },
  errorTitle: { fontSize: Typography.md, color: Colors.text, fontWeight: '600' },
  errorHint: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  scroll: { padding: Spacing.lg, gap: Spacing.xl },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: Typography.xs, color: Colors.text },
  slider: { width: '100%', height: 32 },
  actionBtn: {
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: Typography.sm, color: Colors.text },
  footer: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.white },
})
