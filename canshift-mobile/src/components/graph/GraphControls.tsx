import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'

const WINDOW_OPTIONS = [
  { label: '30s', value: 30, accessibilityLabel: '30 second window' },
  { label: '1m', value: 60, accessibilityLabel: '1 minute window' },
  { label: '2m', value: 120, accessibilityLabel: '2 minute window' },
]

interface GraphControlsProps {
  paused: boolean
  windowSecs: number
  onTogglePause: () => void
  onSetWindow: (s: number) => void
  onClear: () => void
  vGap: number
}

export const GraphControls = ({
  paused,
  windowSecs,
  onTogglePause,
  onSetWindow,
  onClear,
  vGap,
}: GraphControlsProps) => {
  return (
    <View style={[styles.controls, { paddingVertical: vGap }]}>
      <TouchableOpacity
        style={styles.pauseBtn}
        onPress={onTogglePause}
        hitSlop={HitSlop.vertical}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Resume graph' : 'Pause graph'}
      >
        <Text style={styles.pauseBtnText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
      </TouchableOpacity>
      <View style={styles.windowRow}>
        {WINDOW_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.windowBtn, windowSecs === opt.value && styles.windowBtnActive]}
            onPress={() => {
              onSetWindow(opt.value)
            }}
            hitSlop={HitSlop.vertical}
            accessibilityRole="button"
            accessibilityLabel={opt.accessibilityLabel}
            accessibilityState={{ selected: windowSecs === opt.value }}
          >
            <Text
              style={[styles.windowBtnText, windowSecs === opt.value && styles.windowBtnTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.clearBtn}
        onPress={onClear}
        hitSlop={HitSlop.vertical}
        accessibilityRole="button"
        accessibilityLabel="Clear graph data"
      >
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  pauseBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseBtnText: { fontSize: Typography.xs, color: Colors.textDim },
  windowRow: { flexDirection: 'row', gap: Spacing.xs },
  windowBtn: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  windowBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  windowBtnText: { fontSize: Typography.xs, color: Colors.textMuted },
  windowBtnTextActive: { color: Colors.accent, fontWeight: '700' },
  clearBtn: {
    marginLeft: 'auto',
    minHeight: 36,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  clearText: { fontSize: Typography.xs, color: Colors.textMuted },
})
