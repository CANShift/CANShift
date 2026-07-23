import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import { readAppVersion } from '../lib/expo-version'
import { isAllowedExternalUrl } from '../lib/safe-url'
import { classify } from '../lib/semver'
import type { ComparisonKind } from '../lib/semver'
import { ScreenHeader } from '../components/ScreenHeader'
import { ComparisonBadge } from '../components/about/ComparisonBadge'
import { ErrorBlock } from '../components/about/ErrorBlock'
import { ReleaseBody } from '../components/about/ReleaseBody'
import { FooterRow } from '../components/about/FooterRow'
import { log } from '../stores/log.store'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Radius, Spacing, Typography } from '../theme'
import { useLatestRelease } from '../hooks/use-latest-release'
import type { LatestReleaseResult, ReleaseInfo } from '@tmbk/canshift-core'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'About'>
}

const PRE_RELEASE_TOGGLE_KEY = 'canshift.mobile.releases.showPrerelease'

const loadPreReleaseToggle = async (): Promise<boolean> => {
  try {
    const stored = await SecureStore.getItemAsync(PRE_RELEASE_TOGGLE_KEY)
    if (stored === null) return true
    return stored !== 'false'
  } catch (err) {
    log(
      'warn',
      `Failed to load pre-release toggle — defaulting to on: ${err instanceof Error ? err.message : String(err)}`
    )
    return true
  }
}

const savePreReleaseToggle = async (value: boolean): Promise<void> => {
  try {
    await SecureStore.setItemAsync(PRE_RELEASE_TOGGLE_KEY, value ? 'true' : 'false')
  } catch (err) {
    log(
      'warn',
      `Failed to persist pre-release toggle: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export default function AboutScreen({ navigation }: Props) {
  const { state, isFetching, refresh } = useLatestRelease()
  const [currentVersion] = useState<string | null>(readAppVersion)
  const [showPreRelease, setShowPreRelease] = useState<boolean>(true)
  const [notesOpen, setNotesOpen] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    void loadPreReleaseToggle()
      .then((value) => {
        if (!cancelled) setShowPreRelease(value)
      })
      .catch(() => {
        if (!cancelled) setShowPreRelease(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTogglePreRelease = useCallback((next: boolean) => {
    setShowPreRelease(next)
    void savePreReleaseToggle(next)
  }, [])

  const result: LatestReleaseResult | null =
    state.status === 'ready' ? state.result : state.previous

  const displayedRelease = useMemo<ReleaseInfo | null>(() => {
    if (!result) return null
    if (result.ok) {
      if (showPreRelease && result.prerelease !== null) {
        return result.prerelease
      }
      return result.release
    }
    return result.cached?.release ?? null
  }, [result, showPreRelease])

  const comparison = useMemo<ComparisonKind>(() => {
    if (!displayedRelease) return { kind: 'unknown' }
    const referenceRelease = result?.ok
      ? result.release
      : (result?.cached?.release ?? displayedRelease)
    const referencePrerelease = result?.ok
      ? result.prerelease
      : (result?.cached?.prerelease ?? null)
    return classify(currentVersion, referenceRelease, referencePrerelease)
  }, [currentVersion, displayedRelease, result])

  const openUrl = useCallback((url: string) => {
    if (!isAllowedExternalUrl(url)) {
      Alert.alert("Couldn't open link", `Blocked link (scheme not allowed): ${url}`)
      return
    }
    void Linking.openURL(url).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert("Couldn't open link", message)
    })
  }, [])

  const hasPreRelease = result?.ok === true && result.prerelease !== null
  const showLoadingPlaceholder = state.status === 'loading' && displayedRelease === null
  const failureWithoutCache =
    result !== null && !result.ok && displayedRelease === null ? result : null

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
          <Text style={styles.cardTitle}>Updates &amp; Releases</Text>

          <View style={styles.versionRow}>
            <View>
              <Text style={styles.versionLabel}>Current</Text>
              <Text style={styles.versionValue}>
                {currentVersion !== null ? `v${currentVersion}` : '—'}
              </Text>
            </View>
            <View style={styles.versionColRight}>
              <Text style={styles.versionLabel}>
                {displayedRelease?.prerelease === true ? 'Latest pre-release' : 'Latest'}
              </Text>
              <Text style={styles.versionValue}>
                {displayedRelease !== null ? `v${displayedRelease.version}` : '—'}
              </Text>
            </View>
          </View>

          <ComparisonBadge comparison={comparison} />

          {showLoadingPlaceholder ? (
            <View style={styles.placeholder}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.placeholderText}>Fetching release info from GitHub…</Text>
            </View>
          ) : failureWithoutCache !== null ? (
            <ErrorBlock message={failureWithoutCache.message} />
          ) : displayedRelease !== null ? (
            <ReleaseBody
              release={displayedRelease}
              notesOpen={notesOpen}
              onToggleNotes={() => {
                setNotesOpen((o) => !o)
              }}
              onOpenUrl={openUrl}
            />
          ) : null}

          <FooterRow
            result={result}
            isFetching={isFetching}
            onRefresh={refresh}
            showPreRelease={showPreRelease}
            onTogglePreRelease={handleTogglePreRelease}
            hasPreRelease={hasPreRelease}
          />
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
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  versionColRight: { alignItems: 'flex-end' },
  versionLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  versionValue: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  placeholder: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  placeholderText: { fontSize: Typography.xs, color: Colors.textMuted },
})
