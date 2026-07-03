import React, { useEffect, useRef } from 'react'
import { Animated, View, Text, StyleSheet } from 'react-native'
import { TriangleAlert } from 'lucide-react-native'
import {
  WARNING_BLINK_OPACITY,
  WARNING_BLINK_PERIOD_MS,
  WARNING_IDLE_BG_OPACITY,
  WARNING_SIGNAL_LABEL_MIN_HEIGHT,
  WARNING_STALE_BORDER_WIDTH,
  WIDGET_ZONE_COLORS,
  sensorDefaultDangerThreshold,
  widgetStaleTextColor,
} from '@tmbk/canshift-core'
import { Colors, Typography } from '../../theme'
import { SIGNAL_META, type SignalKey } from '../../constants/ble'
import { signalKeyToSensorKind } from '../../theme/signal-colors'
import { warningState } from './widget-value'

interface WarningWidgetProps {
  signalKey: SignalKey
  value: number | undefined
  size: number
  dayMode?: boolean
}

const OPACITY_BYTE_MAX = 0xff
const ICON_SIZE_RATIO = 0.5

const IDLE_BG_OPACITY = WARNING_IDLE_BG_OPACITY / OPACITY_BYTE_MAX
const BLINK_MIN_OPACITY = WARNING_BLINK_OPACITY.min / OPACITY_BYTE_MAX
const BLINK_MAX_OPACITY = WARNING_BLINK_OPACITY.max / OPACITY_BYTE_MAX
const BLINK_HALF_PERIOD_MS = WARNING_BLINK_PERIOD_MS / 2

const WarningWidget = ({ signalKey, value, size, dayMode = false }: WarningWidgetProps) => {
  const kind = signalKeyToSensorKind(signalKey)
  const bgOpacity = useRef(new Animated.Value(IDLE_BG_OPACITY)).current

  const danger = kind ? sensorDefaultDangerThreshold(kind) : undefined
  const state = danger
    ? warningState(value, danger.threshold, danger.invertLogic)
    : ('idle' as const)

  useEffect(() => {
    if (state !== 'alarm') {
      bgOpacity.setValue(state === 'stale' ? 0 : IDLE_BG_OPACITY)
      return
    }
    bgOpacity.setValue(BLINK_MAX_OPACITY)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgOpacity, {
          toValue: BLINK_MIN_OPACITY,
          duration: 0,
          delay: BLINK_HALF_PERIOD_MS,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: BLINK_MAX_OPACITY,
          duration: 0,
          delay: BLINK_HALF_PERIOD_MS,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => {
      loop.stop()
    }
  }, [state, bgOpacity])

  if (!danger || state === 'idle') return null

  const meta = SIGNAL_META[signalKey]
  const stale = state === 'stale'
  const staleColor = widgetStaleTextColor(dayMode)
  const iconColor = stale ? staleColor : WIDGET_ZONE_COLORS.danger
  const iconSize = Math.round(size * ICON_SIZE_RATIO)
  const showLabel = size >= WARNING_SIGNAL_LABEL_MIN_HEIGHT

  const alarm = state === 'alarm'
  const a11y = alarm
    ? {
        accessibilityRole: 'alert' as const,
        accessibilityLiveRegion: 'assertive' as const,
        accessibilityLabel: `${meta.label} warning`,
      }
    : { accessibilityLabel: `${meta.label} ${stale ? 'stale' : 'normal'}` }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        stale && {
          borderWidth: WARNING_STALE_BORDER_WIDTH,
          borderColor: staleColor,
        },
      ]}
      {...a11y}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: WIDGET_ZONE_COLORS.danger, opacity: bgOpacity },
        ]}
      />
      <TriangleAlert color={iconColor} size={iconSize} />
      {showLabel ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.label, { color: stale ? staleColor : Colors.textMuted }]}
        >
          {meta.label.toUpperCase()}
        </Text>
      ) : null}
    </View>
  )
}

export default React.memo(WarningWidget)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: Typography.xs,
    letterSpacing: 1,
    marginTop: 2,
  },
})
