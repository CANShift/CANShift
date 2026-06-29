import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Markdown from 'react-native-markdown-display'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'
import { formatBytes, formatDate } from '../../lib/format'

interface ReleaseBodyProps {
  release: ReleaseInfo
  notesOpen: boolean
  onToggleNotes: () => void
  onOpenUrl: (url: string) => void
}

export const ReleaseBody = ({ release, notesOpen, onToggleNotes, onOpenUrl }: ReleaseBodyProps) => {
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
        onPress={() => {
          onOpenUrl(release.htmlUrl)
        }}
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
              <Markdown
                style={markdownStyles}
                onLinkPress={(url) => {
                  onOpenUrl(url)
                  return false
                }}
              >
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
              onPress={() => {
                onOpenUrl(asset.downloadUrl)
              }}
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

const styles = StyleSheet.create({
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
})

const markdownStyles = StyleSheet.create({
  body: { color: Colors.text, fontSize: Typography.xs, lineHeight: 18 },
  heading1: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
  },
  heading3: {
    color: Colors.textDim,
    fontSize: Typography.sm,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  bullet_list_icon: { color: Colors.textMuted, marginRight: 6 },
  ordered_list_icon: { color: Colors.textMuted, marginRight: 6 },
  code_inline: {
    backgroundColor: Colors.bg,
    color: Colors.accent,
    fontFamily: 'Courier',
    borderRadius: 3,
    paddingHorizontal: 3,
  },
  fence: { backgroundColor: Colors.bg, borderRadius: 4, padding: 8, marginVertical: 4 },
  code_block: { color: Colors.text, fontFamily: 'Courier', fontSize: Typography.xs },
  link: { color: Colors.accent },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  hr: { backgroundColor: Colors.border, height: 1, marginVertical: 8 },
})
