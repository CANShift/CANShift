import { View, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../../theme'

export const ErrorBlock = ({ message }: { message: string }) => {
  return (
    <View style={styles.errorBlock}>
      <Text style={styles.errorText}>Couldn&apos;t reach GitHub: {message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorBlock: {
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  errorText: { fontSize: Typography.sm, color: Colors.accent },
})
