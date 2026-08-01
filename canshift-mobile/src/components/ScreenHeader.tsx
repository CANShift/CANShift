import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { Colors, Fonts, Typography, Spacing, HitSlop } from '../theme'

interface ScreenHeaderProps {
  title: string
  onBack?: () => void
}

export const ScreenHeader = ({ title, onBack }: ScreenHeaderProps) => (
  <View style={styles.header}>
    {onBack ? (
      <TouchableOpacity
        onPress={onBack}
        hitSlop={HitSlop.default}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={18} color={Colors.accent} />
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
    ) : (
      <View style={styles.spacer} />
    )}
    <Text style={styles.title}>{title}</Text>
    <View style={styles.spacer} />
  </View>
)

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  back: { fontSize: Typography.md, color: Colors.accent },
  title: {
    fontFamily: Fonts.uiExtraBold,
    fontSize: Typography.sm,
    color: Colors.textDim,
    letterSpacing: 1,
  },
  spacer: { width: 48 },
})
