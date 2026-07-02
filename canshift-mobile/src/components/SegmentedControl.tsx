import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'

interface SegmentOption<T> {
  label: string
  value: T
}

interface SegmentedControlProps<T> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export const SegmentedControl = <T extends string | number | boolean | null>({
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) => (
  <View style={styles.row}>
    {options.map((opt) => {
      const active = value === opt.value
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.btn, active && styles.btnActive]}
          onPress={() => {
            onChange(opt.value)
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ selected: active, disabled }}
        >
          <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      )
    })}
  </View>
)

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  btnActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  label: { fontSize: Typography.sm, color: Colors.textMuted },
  labelActive: { color: Colors.accent, fontWeight: '600' },
})
