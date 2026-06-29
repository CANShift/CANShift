import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'
import { getSignalColor } from '../../theme/signal-colors'
import { SIGNAL_META } from '../../constants/ble'

const ALL_SIGNALS = Object.keys(SIGNAL_META)

interface SignalPillRowProps {
  visibleSignals: string[]
  onToggleSignal: (key: string) => void
  vGap: number
}

export const SignalPillRow = ({ visibleSignals, onToggleSignal, vGap }: SignalPillRowProps) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.pillRow, { paddingVertical: vGap }]}
      style={styles.pillBar}
    >
      {ALL_SIGNALS.map((key) => {
        const active = visibleSignals.includes(key)
        const color = getSignalColor(key)
        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, active && { borderColor: color, backgroundColor: `${color}22` }]}
            onPress={() => {
              onToggleSignal(key)
            }}
            hitSlop={HitSlop.default}
          >
            <View
              style={[styles.pillDot, { backgroundColor: active ? color : Colors.textMuted }]}
            />
            <Text style={[styles.pillLabel, active && { color }]}>
              {SIGNAL_META[key]?.label ?? key}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pillBar: { borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 46 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontSize: Typography.xs, color: Colors.textMuted },
})
