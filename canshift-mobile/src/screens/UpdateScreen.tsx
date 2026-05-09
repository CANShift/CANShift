// UpdateScreen.tsx — Firmware OTA update
//
// Flow: fetch releases → select → download → WiFi AP → flash → done

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../theme'
import { Card } from '../components/ui'
import * as OtaService from '../services/ota.service'
import * as BleService from '../services/ble.service'
import { mapBleError } from '../services/ble.errors'
import { useDeviceStore } from '../stores/device.store'
import { ESP32_AP_PASSWORD } from '../constants/ota'
import type { RootStackParamList } from '../navigation'
import {
  BlePermissionDialog,
  type BlePermissionPlatform,
} from '../components/ble-permission-dialog'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Update'>
}

type Step = 'releases' | 'downloading' | 'wifi_wait' | 'pushing' | 'done'

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = ['Select', 'Download', 'Wi-Fi', 'Flash']

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  active && styles.stepDotActive,
                ]}
              >
                <Text style={[styles.stepDotText, (done || active) && styles.stepDotTextActive]}>
                  {done ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          // React Native's DimensionValue requires a `${number}%` literal here,
          // so the eslint restrict-template rule must yield to the RN typing.
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          { width: `${Math.round(value * 100)}%` },
        ]}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Release row
// ---------------------------------------------------------------------------

function ReleaseRow({
  release,
  isCurrent,
  onSelect,
}: {
  release: OtaService.FirmwareRelease
  isCurrent: boolean
  onSelect: () => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)
  const date = new Date(release.publishedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card className="gap-2" style={isCurrent ? styles.releaseCardCurrent : undefined}>
      <View style={styles.releaseHeader}>
        <View style={styles.releaseLeft}>
          <Text style={styles.releaseVersion}>v{release.version}</Text>
          <Text style={styles.releaseDate}>{date}</Text>
        </View>
        <View style={styles.releaseActions}>
          {isCurrent ? (
            <View style={styles.installedBadge}>
              <Text style={styles.installedText}>Installed</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.flashBtn}
              onPress={onSelect}
              hitSlop={HitSlop.default}
            >
              <Text style={styles.flashBtnText}>Flash</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {release.notes.length > 0 && (
        <TouchableOpacity
          style={styles.notesToggle}
          onPress={() => { setNotesOpen((o) => !o) }}
          hitSlop={HitSlop.default}
        >
          <Text style={styles.notesToggleText}>
            {notesOpen ? '▲ Hide notes' : '▼ Release notes'}
          </Text>
        </TouchableOpacity>
      )}
      {notesOpen && release.notes.length > 0 && (
        <Text style={styles.notesBody}>{release.notes}</Text>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function UpdateScreen({ navigation }: Props) {
  const { firmwareVersion, wifiApSsid } = useDeviceStore(
    useShallow((s) => ({ firmwareVersion: s.firmwareVersion, wifiApSsid: s.wifiApSsid })),
  )
  const [releases, setReleases] = useState<OtaService.FirmwareRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('releases')
  const [progress, setProgress] = useState(0)
  const [selectedRelease, setSelectedRelease] = useState<OtaService.FirmwareRelease | null>(null)
  const [localPath, setLocalPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unauthorizedPlatform, setUnauthorizedPlatform] =
    useState<BlePermissionPlatform | null>(null)

  /** Returns true if the error was a permission denial (and the dialog opened);
   *  callers can short-circuit and skip setting a redundant inline error. */
  const handleBleFailure = useCallback((err: unknown): boolean => {
    const mapped = mapBleError(err)
    if (mapped.kind === 'permission-denied') {
      setUnauthorizedPlatform(mapped.platform)
      return true
    }
    return false
  }, [])

  useEffect(() => {
    void OtaService.fetchReleases()
      .then(setReleases)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load releases')
      })
      .finally(() => { setLoading(false) })
  }, [])

  const stepIndex: Record<Step, number> = {
    releases: 0,
    downloading: 1,
    wifi_wait: 2,
    pushing: 3,
    done: 3,
  }

  const handleSelectRelease = useCallback(async (release: OtaService.FirmwareRelease) => {
    setSelectedRelease(release)
    setStep('downloading')
    setProgress(0)
    setError(null)
    try {
      const path = await OtaService.downloadFirmware(release, setProgress)
      setLocalPath(path)
      await BleService.sendCmd('start_wifi_ap')
      setStep('wifi_wait')
    } catch (e) {
      if (handleBleFailure(e)) {
        setStep('releases')
        return
      }
      setError(e instanceof Error ? e.message : 'Download failed')
      setStep('releases')
    }
  }, [handleBleFailure])

  const handlePush = useCallback(async () => {
    if (!localPath) return
    setStep('pushing')
    setProgress(0)
    try {
      await OtaService.pushFirmware(localPath, setProgress)
      setStep('done')
    } catch (e) {
      if (handleBleFailure(e)) {
        setStep('wifi_wait')
        return
      }
      setError(e instanceof Error ? e.message : 'Push failed')
      setStep('wifi_wait')
    }
  }, [localPath, handleBleFailure])

  const normalizedInstalled = firmwareVersion?.replace(/^v/, '') ?? null

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { navigation.goBack() }}
          style={styles.backBtn}
          hitSlop={HitSlop.default}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Firmware Update</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Step indicator — hidden on releases list */}
      {step !== 'releases' && (
        <View style={styles.stepWrapper}>
          <StepIndicator current={stepIndex[step]} />
        </View>
      )}

      {/* Error banner */}
      {error != null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Releases list ── */}
      {step === 'releases' && (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.installedRow}>
            <Text style={styles.installedLabel}>Installed</Text>
            <Text style={styles.installedVersion}>{firmwareVersion ?? 'unknown'}</Text>
          </View>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.hint}>Loading releases…</Text>
            </View>
          ) : (
            releases.map((r) => (
              <ReleaseRow
                key={r.version}
                release={r}
                isCurrent={r.version === normalizedInstalled}
                onSelect={() => { void handleSelectRelease(r) }}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Downloading ── */}
      {step === 'downloading' && (
        <View style={styles.center}>
          <Text style={styles.stepTitle}>Downloading v{selectedRelease?.version}</Text>
          <ProgressBar value={progress} />
          <Text style={styles.hint}>{Math.round(progress * 100)}%</Text>
        </View>
      )}

      {/* ── WiFi wait ── */}
      {step === 'wifi_wait' && (
        <View style={styles.center}>
          <Text style={styles.stepTitle}>Connect to CANShift Wi-Fi</Text>
          {wifiApSsid != null ? (
            <>
              <Card padding="lg" className="w-full items-center gap-1">
                <Text style={styles.ssidLabel}>NETWORK</Text>
                <Text style={styles.ssidValue}>{wifiApSsid}</Text>
                <View style={styles.ssidDivider} />
                <Text style={styles.ssidPwd}>{`Password · ${ESP32_AP_PASSWORD}`}</Text>
              </Card>
              <Text style={styles.hint}>
                {'Go to Settings → Wi-Fi → select the network above,\nthen come back and tap Push.'}
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => { void handlePush() }}
              >
                <Text style={styles.primaryBtnText}>Push firmware →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.hint}>Starting Wi-Fi AP on dashboard…</Text>
            </>
          )}
        </View>
      )}

      {/* ── Pushing ── */}
      {step === 'pushing' && (
        <View style={styles.center}>
          <Text style={styles.stepTitle}>Flashing v{selectedRelease?.version}…</Text>
          <ProgressBar value={progress} />
          <Text style={styles.hint}>Keep the app open until complete.</Text>
        </View>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <View style={styles.center}>
          <View style={styles.doneCircle}>
            <Text style={styles.doneCheck}>✓</Text>
          </View>
          <Text style={styles.stepTitle}>Update complete</Text>
          <Text style={styles.hint}>The dashboard is rebooting.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { navigation.replace('Scan') }}
          >
            <Text style={styles.primaryBtnText}>Reconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      <BlePermissionDialog
        platform={unauthorizedPlatform}
        onDismiss={() => { setUnauthorizedPlatform(null) }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backText: { fontSize: Typography.xl, color: Colors.accent, lineHeight: 26 },
  title: { flex: 1, fontSize: Typography.md, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  headerRight: { width: 36 },

  stepWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  stepDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  stepDotText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  stepDotTextActive: { color: Colors.white },
  stepLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  stepLabelActive: { color: Colors.accent },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginBottom: 14, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.accent },

  errorBanner: {
    backgroundColor: Colors.accentDim,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  errorText: { color: Colors.accent, fontSize: Typography.sm },

  list: { padding: Spacing.lg, gap: Spacing.sm },

  installedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  installedLabel: { fontSize: Typography.xs, color: Colors.textMuted, letterSpacing: 0.5 },
  installedVersion: { fontSize: Typography.sm, color: Colors.text, fontWeight: '600' },

  releaseCardCurrent: { opacity: 0.55 },
  releaseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  releaseLeft: { gap: 2 },
  releaseVersion: { fontSize: Typography.md, fontWeight: '700', color: Colors.text },
  releaseDate: { fontSize: Typography.xs, color: Colors.textMuted },
  releaseActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  installedBadge: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  installedText: { fontSize: Typography.xs, color: Colors.textMuted },
  flashBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  flashBtnText: { fontSize: Typography.sm, color: Colors.white, fontWeight: '700' },
  notesToggle: { paddingTop: Spacing.xs },
  notesToggleText: { fontSize: Typography.xs, color: Colors.textMuted },
  notesBody: {
    fontSize: Typography.xs,
    color: Colors.textDim,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  stepTitle: { fontSize: Typography.lg, fontWeight: '600', color: Colors.text },
  hint: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent },

  ssidLabel: { fontSize: Typography.xs, color: Colors.textMuted, letterSpacing: 1 },
  ssidValue: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  ssidDivider: { width: 40, height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  ssidPwd: { fontSize: Typography.xs, color: Colors.textMuted },

  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  primaryBtnText: { fontSize: Typography.md, color: Colors.white, fontWeight: '700' },

  doneCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: { fontSize: Typography.xl, color: Colors.success },
})
