import { View, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../../theme'
import { comparisonDetail } from '../../lib/semver'
import type { ComparisonKind } from '../../lib/semver'

const COMPARISON_COPY: Record<ComparisonKind['kind'], { tone: string; label: string }> = {
  unknown: { tone: Colors.textMuted, label: 'Version unknown' },
  'up-to-date': { tone: Colors.success, label: 'Up to date' },
  behind: { tone: Colors.warning, label: 'Update available' },
  ahead: { tone: Colors.textDim, label: 'Ahead of latest stable' },
  'on-prerelease': { tone: Colors.warning, label: 'Running a pre-release build' },
}

export const ComparisonBadge = ({ comparison }: { comparison: ComparisonKind }) => {
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

const styles = StyleSheet.create({
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
})
