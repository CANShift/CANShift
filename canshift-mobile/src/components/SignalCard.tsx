import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'
import type { SignalMeta } from '../constants/ble'

interface SignalCardProps {
  meta: SignalMeta
  value: number | undefined
  compact?: boolean
}

const SignalCard = ({ meta, value, compact = false }: SignalCardProps) => {
  const hasValue = value !== undefined

  const formatted = hasValue
    ? meta.decimals === 0
      ? Math.round(value).toString()
      : value.toFixed(meta.decimals)
    : '---'

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.label}>{meta.label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, !hasValue && styles.valueDim]}>{formatted}</Text>
        {meta.unit ? <Text style={styles.unit}>{meta.unit}</Text> : null}
      </View>
    </View>
  )
}

export default React.memo(SignalCard)

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minWidth: 100,
    alignItems: 'center',
  },
  cardCompact: {
    padding: Spacing.sm,
    minWidth: 80,
  },
  label: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  value: {
    fontSize: Typography.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  valueDim: {
    color: Colors.textMuted,
  },
  unit: {
    fontSize: Typography.xs,
    color: Colors.textDim,
    marginBottom: 3,
  },
})
