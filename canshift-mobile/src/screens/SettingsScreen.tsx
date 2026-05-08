// SettingsScreen.tsx — Screen settings pushed to device via BLE

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import Slider from '@react-native-community/slider'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import * as BleService from '../services/ble.service'
import { useDeviceStore } from '../stores/device.store'
import type { RootStackParamList } from '../navigation'
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
  const [calibrating, setCalibrating] = useState(false)
  const [calibrateConfirmOpen, setCalibrateConfirmOpen] = useState(false)

  // Pull current values from the device on mount so sliders/segments don't
  // open at hardcoded defaults that misrepresent the device state (#26).
  // If the read fails (older firmware, transient BLE error), we silently
  // keep the defaults — saving will just push them, no worse than before.
  useEffect(() => {
    let cancelled = false
    void BleService.readSettings()
      .then((current) => {
        if (cancelled || !current) return
        setBrightness(current.brightness)
        setSleep(current.sleep)
      })
      .catch(() => {
        // Older firmware exposes SETTINGS as write-only — fall back to defaults.
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to push settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDayNight = async (target: boolean) => {
    // Idempotent at the UI level — tapping the active segment is a no-op.
    if (isDayMode === target) return
    try {
      // Prefer the explicit command. Older firmware (no set_day_night handler)
      // ignores it gracefully (logs a warning), so we don't double-fire by
      // also sending toggle_day_night — that would defeat the idempotency
      // guarantee the new command exists to provide.
      await BleService.sendCmd('set_day_night', { day: target })
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Command failed')
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Command failed')
    } finally {
      setCalibrating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { navigation.goBack(); }}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SCREEN SETTINGS</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brightness */}
        <View style={styles.section}>
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
        </View>

        {/* Sleep */}
        <View style={styles.section}>
          <Label>SLEEP</Label>
          <View style={styles.segRow}>
            {SLEEP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segBtn, sleep === opt.value && styles.segBtnActive]}
                onPress={() => { setSleep(opt.value); }}
              >
                <Text style={[styles.segLabel, sleep === opt.value && styles.segLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Day / Night */}
        <View style={styles.section}>
          <Label>THEME</Label>
          <View style={styles.segRow}>
            <TouchableOpacity
              style={[styles.segBtn, isDayMode === false && styles.segBtnActive]}
              onPress={() => void handleSetDayNight(false)}
            >
              <Text style={[styles.segLabel, isDayMode === false && styles.segLabelActive]}>
                Night
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, isDayMode === true && styles.segBtnActive]}
              onPress={() => void handleSetDayNight(true)}
            >
              <Text style={[styles.segLabel, isDayMode === true && styles.segLabelActive]}>
                Day
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Touch calibration */}
        <View style={styles.section}>
          <Label>TOUCH</Label>
          <TouchableOpacity
            style={[styles.actionBtn, calibrating && styles.actionBtnDisabled]}
            onPress={handleCalibrate}
            disabled={calibrating}
          >
            <Text style={styles.actionBtnText}>
              {calibrating ? 'Calibrating…' : 'Calibrate Touch Screen'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save */}
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
              The dashboard screen will display calibration crosshairs. Tap each point
              accurately.
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
  section: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: Typography.xs, color: Colors.text },
  slider: { width: '100%', height: 32 },
  segRow: { flexDirection: 'row', gap: Spacing.sm },
  segBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
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
