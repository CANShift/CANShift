import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { gearFontSize } from '@tmbk/canshift-core'
import { SIGNAL_META, type SignalKey } from '../../constants/ble'
import { gearColor, gearGlyphFor } from './widget-value'

interface GearWidgetProps {
  signalKey: SignalKey
  value: number | undefined
  size: number
  dayMode?: boolean
}

const GearWidget = ({ signalKey, value, size, dayMode = false }: GearWidgetProps) => {
  const meta = SIGNAL_META[signalKey]
  const glyph = gearGlyphFor(value)
  const color = gearColor(value, dayMode)
  const fontSize = gearFontSize(size, size)

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityLabel={`${meta.label} ${glyph}`}
    >
      <Text style={{ fontSize, fontWeight: '700', color }}>{glyph}</Text>
    </View>
  )
}

export default React.memo(GearWidget)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
