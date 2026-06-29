import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'
import { formatDate } from '../../lib/format'

interface FooterRowProps {
  result: LatestReleaseResult | null
  isFetching: boolean
  onRefresh: () => void
  showPreRelease: boolean
  onTogglePreRelease: (next: boolean) => void
  hasPreRelease: boolean
}

export const FooterRow = ({
  result,
  isFetching,
  onRefresh,
  showPreRelease,
  onTogglePreRelease,
  hasPreRelease,
}: FooterRowProps) => {
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        onPress={() => {
          onTogglePreRelease(!showPreRelease)
        }}
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

const styles = StyleSheet.create({
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
