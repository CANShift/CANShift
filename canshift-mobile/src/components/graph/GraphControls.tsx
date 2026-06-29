import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius, HitSlop } from '../../theme'

const WINDOW_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
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
      <TouchableOpacity style={styles.pauseBtn} onPress={onTogglePause} hitSlop={HitSlop.default}>
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
            hitSlop={HitSlop.default}
          >
            <Text
              style={[styles.windowBtnText, windowSecs === opt.value && styles.windowBtnTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={onClear} hitSlop={HitSlop.default}>
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseBtnText: { fontSize: Typography.xs, color: Colors.textDim },
  windowRow: { flexDirection: 'row', gap: 2 },
  windowBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  windowBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  windowBtnText: { fontSize: Typography.xs, color: Colors.textMuted },
  windowBtnTextActive: { color: Colors.accent, fontWeight: '700' },
  clearText: { fontSize: Typography.xs, color: Colors.textMuted },
})
