import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
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
        accessibilityRole="checkbox"
        accessibilityLabel="Show pre-release builds"
        accessibilityState={{ checked: showPreRelease && hasPreRelease, disabled: !hasPreRelease }}
      >
        <View
          style={[
            styles.toggleBox,
            showPreRelease && hasPreRelease && styles.toggleBoxOn,
            !hasPreRelease && styles.toggleBoxDisabled,
          ]}
        >
          {showPreRelease && hasPreRelease && <Check size={14} color={Colors.white} />}
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
        accessibilityRole="button"
        accessibilityLabel="Check for updates now"
        accessibilityState={{ disabled: isFetching }}
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44 },
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
