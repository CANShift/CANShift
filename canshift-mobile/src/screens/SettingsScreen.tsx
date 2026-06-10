import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import Slider from '@react-native-community/slider'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../theme'
import * as BleService from '../services/ble.service'
import { mapBleError } from '../services/ble.errors'
import { useDeviceStore } from '../stores/device.store'
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

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>
}

const SLEEP_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
]

export default function SettingsScreen({ navigation }: Props) {
  const isDayMode = useDeviceStore((s) => s.isDayMode)
  const [brightness, setBrightness] = useState(80)
  const [sleep, setSleep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dayNightPending, setDayNightPending] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrateConfirmOpen, setCalibrateConfirmOpen] = useState(false)
  const [unauthorizedPlatform, setUnauthorizedPlatform] = useState<BlePermissionPlatform | null>(
    null
  )

  const handleBleFailure = useCallback((err: unknown, fallbackTitle: string): boolean => {
    const mapped = mapBleError(err)
    if (mapped.kind === 'permission-denied') {
      setUnauthorizedPlatform(mapped.platform)
      return true
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    Alert.alert(fallbackTitle, message)
    return false
  }, [])

  useEffect(() => {
    let cancelled = false
    void BleService.readSettings()
      .then((current) => {
        if (cancelled || !current) return
        setBrightness(current.brightness)
        setSleep(current.sleep)
      })
      .catch(() => {
        void 0
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      handleBleFailure(err, 'Error')
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
      handleBleFailure(err, 'Error')
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
    } catch (err) {
      handleBleFailure(err, 'Error')
    } finally {
      setCalibrating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            navigation.goBack()
          }}
          hitSlop={HitSlop.default}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SCREEN SETTINGS</Text>
        <View style={{ width: 48 }} />
      </View>

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
          <View style={styles.segRow}>
            {SLEEP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segBtn, sleep === opt.value && styles.segBtnActive]}
                onPress={() => {
                  setSleep(opt.value)
                }}
              >
                <Text style={[styles.segLabel, sleep === opt.value && styles.segLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="THEME">
          <View style={styles.segRow}>
            <TouchableOpacity
              style={[styles.segBtn, isDayMode === false && styles.segBtnActive]}
              onPress={() => void handleSetDayNight(false)}
              disabled={dayNightPending}
            >
              <Text style={[styles.segLabel, isDayMode === false && styles.segLabelActive]}>
                Night
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, isDayMode === true && styles.segBtnActive]}
              onPress={() => void handleSetDayNight(true)}
              disabled={dayNightPending}
            >
              <Text style={[styles.segLabel, isDayMode === true && styles.segLabelActive]}>
                Day
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="TOUCH">
          <TouchableOpacity
            style={[styles.actionBtn, calibrating && styles.actionBtnDisabled]}
            onPress={handleCalibrate}
            disabled={calibrating}
          >
            <Text style={styles.actionBtnText}>
              {calibrating ? 'Calibrating…' : 'Calibrate Touch Screen'}
            </Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { fontSize: Typography.md, color: Colors.accent, width: 48 },
  title: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textDim, letterSpacing: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.xl },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: Typography.xs, color: Colors.text },
  slider: { width: '100%', height: 32 },
  segRow: { flexDirection: 'row', gap: Spacing.sm },
  segBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  segLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  segLabelActive: { color: Colors.accent, fontWeight: '600' },
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
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.white },
})
