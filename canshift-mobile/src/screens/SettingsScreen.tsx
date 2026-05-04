// SettingsScreen.tsx — Screen settings pushed to device via BLE

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import Slider from '@react-native-community/slider'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import * as BleService from '../services/ble.service'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>
}

const SLEEP_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
]

const ROTATION_OPTIONS: Array<{ label: string; value: 0 | 90 | 180 | 270 }> = [
  { label: '0°', value: 0 },
  { label: '90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '270°', value: 270 },
]

export default function SettingsScreen({ navigation }: Props) {
  const [brightness, setBrightness] = useState(80)
  const [sleep, setSleep] = useState(0)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await BleService.pushSettings({ brightness, sleep, rotation })
      Alert.alert('Saved', 'Settings applied to dashboard.')
      navigation.goBack()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to push settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SCREEN SETTINGS</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brightness */}
        <View style={styles.section}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>BRIGHTNESS</Text>
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
          <Text style={styles.label}>SLEEP</Text>
          <View style={styles.segRow}>
            {SLEEP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segBtn, sleep === opt.value && styles.segBtnActive]}
                onPress={() => setSleep(opt.value)}
              >
                <Text
                  style={[styles.segLabel, sleep === opt.value && styles.segLabelActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rotation */}
        <View style={styles.section}>
          <Text style={styles.label}>ROTATION</Text>
          <View style={styles.segRow}>
            {ROTATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segBtn, rotation === opt.value && styles.segBtnActive]}
                onPress={() => setRotation(opt.value)}
              >
                <Text
                  style={[styles.segLabel, rotation === opt.value && styles.segLabelActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  label: { fontSize: Typography.xs, color: Colors.textMuted, letterSpacing: 0.8 },
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
  footer: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  saveBtn: {
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.success },
})
