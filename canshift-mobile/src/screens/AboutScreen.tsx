// AboutScreen.tsx — Current vs latest GitHub release card (issue #571).
//
// Reachable from the dashboard top-bar menu. Mirrors the studio
// `ReleaseInfoCard` surface: shows the running app version, the latest tag
// fetched from GitHub, a comparison badge, the release notes, the asset
// list, and a button that opens the release page on github.com.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import { SafeAreaView } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, HitSlop, Radius, Spacing, Typography } from '../theme'
import { useLatestRelease } from '../hooks/use-latest-release'
import type { LatestReleaseResult, ReleaseInfo } from '../services/releases.types'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'About'>
}

const PRE_RELEASE_TOGGLE_KEY = 'canshift.mobile.releases.showPrerelease'

type ComparisonKind =
  | { kind: 'unknown' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'behind'; current: string; latest: string }
  | { kind: 'ahead'; current: string; latest: string }
  | { kind: 'on-prerelease'; current: string; latestStable: string | null }

interface SemverParts {
  major: number
  minor: number
  patch: number
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested via about-helpers.test.ts)
// ---------------------------------------------------------------------------

function parseSemver(input: string): SemverParts | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(input.trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (![major, minor, patch].every((n) => Number.isFinite(n))) return null
  return { major, minor, patch }
}

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

function isPreReleaseTag(version: string): boolean {
  return /[-+]/.test(version)
}

export function classify(
  currentRaw: string | null,
  release: ReleaseInfo,
  prerelease: ReleaseInfo | null,
): ComparisonKind {
  if (currentRaw === null) return { kind: 'unknown' }
  const current = parseSemver(currentRaw)
  const latestStable = parseSemver(release.version)
  if (!current || !latestStable) return { kind: 'unknown' }

  if (isPreReleaseTag(currentRaw) || currentRaw === prerelease?.version) {
    return {
      kind: 'on-prerelease',
      current: currentRaw,
      latestStable: release.version,
    }
  }

  const delta = compareSemver(current, latestStable)
  if (delta === 0) return { kind: 'up-to-date', current: currentRaw }
  if (delta < 0) return { kind: 'behind', current: currentRaw, latest: release.version }
  return { kind: 'ahead', current: currentRaw, latest: release.version }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${String(bytes)} B`
}

export function formatDate(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString()
}

function readAppVersion(): string | null {
  const fromConfig = Constants.expoConfig?.version
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig
  // Older Expo manifest shapes expose `nativeAppVersion` / `version`. Fall
  // back to those so dev builds without a resolved config still show a value.
  const legacy = (Constants as unknown as { nativeAppVersion?: unknown; version?: unknown })
  if (typeof legacy.nativeAppVersion === 'string' && legacy.nativeAppVersion.length > 0) {
    return legacy.nativeAppVersion
  }
  if (typeof legacy.version === 'string' && legacy.version.length > 0) {
    return legacy.version
  }
  return null
}

async function loadPreReleaseToggle(): Promise<boolean> {
  // Pre-1.0 we publish every build as a pre-release, so the toggle defaults
  // to `true`. Flip the default to `false` once the app ships v1.0.
  try {
    const stored = await SecureStore.getItemAsync(PRE_RELEASE_TOGGLE_KEY)
    if (stored === null) return true
    return stored !== 'false'
  } catch {
    return true
  }
}

async function savePreReleaseToggle(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(PRE_RELEASE_TOGGLE_KEY, value ? 'true' : 'false')
  } catch {
    // Persistence is best-effort — the toggle still works for the session.
  }
}

const COMPARISON_COPY: Record<ComparisonKind['kind'], { tone: string; label: string }> = {
  unknown: { tone: Colors.textMuted, label: 'Version unknown' },
  'up-to-date': { tone: Colors.success, label: 'Up to date' },
  behind: { tone: Colors.warning, label: 'Update available' },
  ahead: { tone: Colors.textDim, label: 'Ahead of latest stable' },
  'on-prerelease': { tone: Colors.warning, label: 'Running a pre-release build' },
}

function comparisonDetail(comparison: ComparisonKind): string | null {
  switch (comparison.kind) {
    case 'behind':
      return `v${comparison.current} → v${comparison.latest}`
    case 'ahead':
      return `Running v${comparison.current} (latest stable: v${comparison.latest})`
    case 'on-prerelease':
      return comparison.latestStable !== null
        ? `Running v${comparison.current} · latest stable v${comparison.latestStable}`
        : `Running v${comparison.current}`
    case 'up-to-date':
      return `v${comparison.current}`
    case 'unknown':
      return null
    default: {
      const exhaustive: never = comparison
      return exhaustive
    }
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AboutScreen({ navigation }: Props) {
  const { state, isFetching, refresh } = useLatestRelease()
  const [currentVersion] = useState<string | null>(readAppVersion)
  const [showPreRelease, setShowPreRelease] = useState<boolean>(true)
  const [notesOpen, setNotesOpen] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    void loadPreReleaseToggle().then((value) => {
      if (!cancelled) setShowPreRelease(value)
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
    void Linking.openURL(url).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert("Couldn't open link", message)
    })
  }, [])

  const hasPreRelease = result?.ok === true && result.prerelease !== null
  const showLoadingPlaceholder = state.status === 'loading' && displayedRelease === null
  // Only set when an explicit failure happened AND we have nothing to display.
  // The `result` discriminant is narrowed inline so the JSX can read `.message`.
  const failureWithoutCache =
    result !== null && !result.ok && displayedRelease === null ? result : null

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { navigation.goBack() }}
          hitSlop={HitSlop.default}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ABOUT</Text>
        <View style={{ width: 48 }} />
      </View>

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
            <View style={{ alignItems: 'flex-end' }}>
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
              onToggleNotes={() => { setNotesOpen((o) => !o) }}
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ComparisonBadge({ comparison }: { comparison: ComparisonKind }) {
  const { tone, label } = COMPARISON_COPY[comparison.kind]
  const detail = comparisonDetail(comparison)
  return (
    <View style={[styles.badge, { borderColor: `${tone}55` }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.badgeLabel, { color: tone }]}>{label}</Text>
        {detail !== null && <Text style={styles.badgeDetail}>{detail}</Text>}
      </View>
    </View>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <View style={styles.errorBlock}>
      <Text style={styles.errorText}>Couldn&apos;t reach GitHub: {message}</Text>
    </View>
  )
}

function ReleaseBody({
  release,
  notesOpen,
  onToggleNotes,
  onOpenUrl,
}: {
  release: ReleaseInfo
  notesOpen: boolean
  onToggleNotes: () => void
  onOpenUrl: (url: string) => void
}) {
  return (
    <>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Published {formatDate(release.publishedAt)}</Text>
        {release.prerelease && (
          <View style={styles.preBadge}>
            <Text style={styles.preBadgeText}>PRE-RELEASE</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.openLink}
        onPress={() => { onOpenUrl(release.htmlUrl) }}
        hitSlop={HitSlop.default}
      >
        <Text style={styles.openLinkText}>Open on GitHub ↗</Text>
      </TouchableOpacity>

      {release.notes.length > 0 && (
        <View style={styles.notesWrap}>
          <TouchableOpacity
            style={styles.notesToggle}
            onPress={onToggleNotes}
            hitSlop={HitSlop.default}
          >
            <Text style={styles.notesToggleText}>
              {notesOpen ? '▲ Hide release notes' : '▼ Show release notes'}
            </Text>
          </TouchableOpacity>
          {notesOpen && (
            <View style={styles.notesBlock}>
              <Markdown style={markdownStyles} onLinkPress={(url) => { onOpenUrl(url); return false }}>
                {release.notes}
              </Markdown>
            </View>
          )}
        </View>
      )}

      {release.assets.length > 0 && (
        <View style={styles.assetsWrap}>
          <Text style={styles.assetsTitle}>Assets</Text>
          {release.assets.map((asset) => (
            <TouchableOpacity
              key={asset.downloadUrl}
              style={styles.assetRow}
              onPress={() => { onOpenUrl(asset.downloadUrl) }}
              hitSlop={HitSlop.default}
            >
              <Text style={styles.assetName} numberOfLines={1}>
                {asset.name}
              </Text>
              <Text style={styles.assetSize}>{formatBytes(asset.sizeBytes)}</Text>
              <Text style={styles.assetOpen}>Open ↗</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  )
}

function FooterRow({
  result,
  isFetching,
  onRefresh,
  showPreRelease,
  onTogglePreRelease,
  hasPreRelease,
}: {
  result: LatestReleaseResult | null
  isFetching: boolean
  onRefresh: () => void
  showPreRelease: boolean
  onTogglePreRelease: (next: boolean) => void
  hasPreRelease: boolean
}) {
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        onPress={() => { onTogglePreRelease(!showPreRelease) }}
        disabled={!hasPreRelease}
        hitSlop={HitSlop.default}
        style={styles.toggleRow}
      >
        <View
          style={[
            styles.toggleBox,
            showPreRelease && hasPreRelease && styles.toggleBoxOn,
            !hasPreRelease && styles.toggleBoxDisabled,
          ]}
        >
          {showPreRelease && hasPreRelease && <Text style={styles.toggleCheck}>✓</Text>}
        </View>
        <Text style={[styles.toggleLabel, !hasPreRelease && styles.toggleLabelDisabled]}>
          Show pre-release builds
        </Text>
      </TouchableOpacity>

      {result !== null && (
        <Text style={styles.lastChecked}>Last checked: {formatDate(result.fetchedAt)}</Text>
      )}

      <TouchableOpacity
        style={[styles.refreshBtn, isFetching && styles.refreshBtnDisabled]}
        onPress={onRefresh}
        disabled={isFetching}
        hitSlop={HitSlop.default}
      >
        <Text style={styles.refreshBtnText}>{isFetching ? 'Checking…' : 'Check now'}</Text>
      </TouchableOpacity>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const markdownStyles = StyleSheet.create({
  body: { color: Colors.text, fontSize: Typography.xs, lineHeight: 18 },
  heading1: { color: Colors.text, fontSize: Typography.lg, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  heading2: { color: Colors.text, fontSize: Typography.md, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  heading3: { color: Colors.textDim, fontSize: Typography.sm, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  bullet_list_icon: { color: Colors.textMuted, marginRight: 6 },
  ordered_list_icon: { color: Colors.textMuted, marginRight: 6 },
  code_inline: { backgroundColor: Colors.bg, color: Colors.accent, fontFamily: 'Courier', borderRadius: 3, paddingHorizontal: 3 },
  fence: { backgroundColor: Colors.bg, borderRadius: 4, padding: 8, marginVertical: 4 },
  code_block: { color: Colors.text, fontFamily: 'Courier', fontSize: Typography.xs },
  link: { color: Colors.accent },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  hr: { backgroundColor: Colors.border, height: 1, marginVertical: 8 },
})

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
  title: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 1,
  },
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeLabel: { fontSize: Typography.sm, fontWeight: '700' },
  badgeDetail: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  placeholder: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  placeholderText: { fontSize: Typography.xs, color: Colors.textMuted },
  errorBlock: {
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  errorText: { fontSize: Typography.sm, color: Colors.accent },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: Typography.xs, color: Colors.textDim },
  preBadge: {
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  preBadgeText: {
    fontSize: 9,
    color: Colors.warning,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  openLink: { alignSelf: 'flex-start' },
  openLinkText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: '600' },
  notesWrap: { gap: Spacing.xs },
  notesToggle: { alignSelf: 'flex-start' },
  notesToggleText: { fontSize: Typography.xs, color: Colors.textMuted },
  notesBlock: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  assetsWrap: { gap: Spacing.xs },
  assetsTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  assetName: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.text,
    fontFamily: 'Courier',
  },
  assetSize: { fontSize: Typography.xs, color: Colors.textMuted },
  assetOpen: { fontSize: Typography.xs, color: Colors.accent, fontWeight: '600' },
  footer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toggleBox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleBoxDisabled: { opacity: 0.4 },
  toggleCheck: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  toggleLabel: { fontSize: Typography.sm, color: Colors.text },
  toggleLabelDisabled: { color: Colors.textMuted },
  lastChecked: { fontSize: 10, color: Colors.textMuted },
  refreshBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnText: { fontSize: Typography.sm, color: Colors.text },
})
