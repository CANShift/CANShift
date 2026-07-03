import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  STALE_PLACEHOLDER,
  VALUE_UNIT_FONT_SIZE,
  WIDGET_STALE_TEXT_COLORS,
  WIDGET_TEXT_COLORS,
  labelFontSize,
  widgetFracFontSize,
  widgetStaleTextColor,
  widgetTextColor,
} from '@tmbk/canshift-core'
import { Colors, Radius, Spacing, Typography } from '../../theme'
import { SIGNAL_META, type SignalKey } from '../../constants/ble'
import { sensorRampColorAt, signalKeyToSensorKind } from '../../theme/signal-colors'
import { formatWidgetValue, splitWidgetValue } from './widget-value'

interface LabelWidgetProps {
  signalKey: SignalKey
  value: number | undefined
  width: number
  height: number
  dayMode?: boolean
}

const LabelWidget = ({ signalKey, value, width, height, dayMode = false }: LabelWidgetProps) => {
  const meta = SIGNAL_META[signalKey]
  const kind = signalKeyToSensorKind(signalKey)
  const stale = value === undefined

  const intFontSize = labelFontSize(width, height)
  const fracFontSize = widgetFracFontSize(intFontSize)

  const parts = stale
    ? { int: STALE_PLACEHOLDER, frac: '' }
    : splitWidgetValue(formatWidgetValue(value, meta.decimals), true)

  const tint = stale
    ? widgetStaleTextColor(dayMode)
    : kind
      ? sensorRampColorAt(kind, value)
      : widgetTextColor(dayMode)
  const unitColor = dayMode ? WIDGET_TEXT_COLORS.day : WIDGET_STALE_TEXT_COLORS.day

  return (
    <View
      style={[styles.card, { width, height }]}
      accessibilityLabel={`${meta.label} ${stale ? STALE_PLACEHOLDER : String(value)} ${meta.unit}`}
    >
      <Text style={styles.label} numberOfLines={1}>
        {meta.label.toUpperCase()}
      </Text>
      <View style={styles.valueRow}>
        <Text style={{ fontSize: intFontSize, fontWeight: '700', color: tint }} numberOfLines={1}>
          {parts.int}
        </Text>
        {parts.frac ? (
          <Text
            style={{ fontSize: fracFontSize, fontWeight: '700', color: tint }}
            numberOfLines={1}
          >
            {parts.frac}
          </Text>
        ) : null}
        {meta.unit ? (
          <Text style={[styles.unit, { fontSize: VALUE_UNIT_FONT_SIZE, color: unitColor }]}>
            {meta.unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export default React.memo(LabelWidget)

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
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
  unit: {
    marginBottom: 3,
  },
})
