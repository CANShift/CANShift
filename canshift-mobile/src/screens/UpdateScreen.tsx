// UpdateScreen.tsx — Firmware OTA update flow
//
// Step 1: Fetch available releases from GitHub (over cellular)
// Step 2: Download selected firmware binary (over cellular, cached)
// Step 3: Trigger WiFi AP on device via BLE CMD
// Step 4: User connects phone to CANShift WiFi
// Step 5: Push firmware binary via HTTP POST /ota

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius } from '../theme'
import * as OtaService from '../services/ota.service'
import * as BleService from '../services/ble.service'
import { useDeviceStore } from '../stores/device.store'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Update'>
}

type Step = 'releases' | 'downloading' | 'wifi_wait' | 'pushing' | 'done'

export default function UpdateScreen({ navigation }: Props) {
  const { firmwareVersion, wifiApSsid } = useDeviceStore()
  const [releases, setReleases] = useState<OtaService.FirmwareRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('releases')
  const [progress, setProgress] = useState(0)
  const [selectedRelease, setSelectedRelease] = useState<OtaService.FirmwareRelease | null>(null)
  const [localPath, setLocalPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void OtaService.fetchReleases()
      .then(setReleases)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load releases'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectRelease = useCallback(async (release: OtaService.FirmwareRelease) => {
    setSelectedRelease(release)
    setStep('downloading')
    setProgress(0)
    setError(null)

    try {
      const path = await OtaService.downloadFirmware(release, setProgress)
      setLocalPath(path)

      // Tell device to start WiFi AP — firmware will push SSID via STATUS notification
      await BleService.sendCmd('start_wifi_ap')
      setStep('wifi_wait')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
      setStep('releases')
    }
  }, [])

  const handlePush = useCallback(async () => {
    if (!localPath) return
    setStep('pushing')
    setProgress(0)

    try {
      await OtaService.pushFirmware(localPath, setProgress)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed')
      setStep('wifi_wait')
    }
  }, [localPath])

  const renderReleaseItem = ({ item }: { item: OtaService.FirmwareRelease }) => {
    const isCurrent = item.version === firmwareVersion?.replace(/^v/, '')
    return (
      <TouchableOpacity
        style={[styles.releaseRow, isCurrent && styles.releaseRowCurrent]}
        onPress={() => void handleSelectRelease(item)}
        disabled={isCurrent}
      >
        <View>
          <Text style={styles.releaseVersion}>v{item.version}</Text>
          <Text style={styles.releaseDate}>
            {new Date(item.publishedAt).toLocaleDateString()}
            {isCurrent ? '  · installed' : ''}
          </Text>
        </View>
        {!isCurrent && <Text style={styles.releaseArrow}>›</Text>}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>FIRMWARE UPDATE</Text>
        <View style={{ width: 48 }} />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {step === 'releases' && (
        <>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.hint}>Loading releases…</Text>
            </View>
          ) : (
            <FlatList
              data={releases}
              keyExtractor={(r) => r.version}
              contentContainerStyle={styles.list}
              renderItem={renderReleaseItem}
              ListHeaderComponent={
                <Text style={styles.sectionLabel}>
                  Installed: {firmwareVersion ?? 'unknown'}
                </Text>
              }
            />
          )}
        </>
      )}

      {step === 'downloading' && (
        <View style={styles.center}>
          <Text style={styles.stepLabel}>Downloading v{selectedRelease?.version}…</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.hint}>{Math.round(progress * 100)}%</Text>
        </View>
      )}

      {step === 'wifi_wait' && (
        <View style={styles.center}>
          <Text style={styles.stepLabel}>Connect to CANShift WiFi</Text>
          {wifiApSsid ? (
            <>
              <View style={styles.ssidBox}>
                <Text style={styles.ssidLabel}>NETWORK</Text>
                <Text style={styles.ssidValue}>{wifiApSsid}</Text>
                <Text style={styles.ssidPwd}>Password: canshift</Text>
              </View>
              <Text style={styles.hint}>{'Settings → Wi-Fi → select the network above\nthen come back and tap Push'}</Text>
            </>
          ) : (
            <Text style={styles.hint}>{'Starting WiFi AP…\nThe network name will appear shortly.'}</Text>
          )}
          <TouchableOpacity
            style={[styles.pushBtn, !wifiApSsid && styles.pushBtnDisabled]}
            onPress={() => void handlePush()}
            disabled={!wifiApSsid}
          >
            <Text style={styles.pushBtnText}>Push firmware</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'pushing' && (
        <View style={styles.center}>
          <Text style={styles.stepLabel}>Flashing…</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.hint}>Do not close the app</Text>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.center}>
          <Text style={styles.doneText}>✓</Text>
          <Text style={styles.stepLabel}>Update complete</Text>
          <Text style={styles.hint}>The dashboard is rebooting.</Text>
          <TouchableOpacity
            style={styles.pushBtn}
            onPress={() => navigation.replace('Scan')}
          >
            <Text style={styles.pushBtnText}>Reconnect</Text>
          </TouchableOpacity>
        </View>
      )}
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
  errorBanner: {
    backgroundColor: Colors.accentDim,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    padding: Spacing.md,
  },
  errorText: { color: Colors.accent, fontSize: Typography.sm },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  sectionLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  releaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  releaseRowCurrent: { opacity: 0.5 },
  releaseVersion: { fontSize: Typography.md, fontWeight: '600', color: Colors.text },
  releaseDate: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  releaseArrow: { fontSize: Typography.xl, color: Colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  stepLabel: { fontSize: Typography.lg, fontWeight: '600', color: Colors.text },
  hint: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  ssidBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  ssidLabel: { fontSize: Typography.xs, color: Colors.textMuted, letterSpacing: 1 },
  ssidValue: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  ssidPwd: { fontSize: Typography.xs, color: Colors.textMuted },
  pushBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  pushBtnDisabled: { opacity: 0.4 },
  pushBtnText: { fontSize: Typography.md, color: Colors.text, fontWeight: '600' },
  doneText: { fontSize: 64, color: Colors.success },
})
