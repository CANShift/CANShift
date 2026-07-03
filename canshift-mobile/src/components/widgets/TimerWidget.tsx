import React, { useEffect, useState } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import {
  TIMER_BLINK_PERIOD_MS,
  TIMER_BORDER_COLORS,
  TIMER_LONG_PRESS_MS,
  TIMER_STATE_BORDER_WIDTH,
  timerFontSize,
  widgetTextColor,
} from '@tmbk/canshift-core'
import { Colors, Radius, Spacing } from '../../theme'
import { elapsedMsOf, useTimerStore, type TimerStatus } from '../../stores/timer.store'
import { formatTimerElapsed } from './widget-value'

interface TimerWidgetProps {
  width: number
  height: number
  dayMode?: boolean
}

const DISPLAY_TICK_MS = 50
const BLINK_HALF_PERIOD_MS = TIMER_BLINK_PERIOD_MS / 2
const IDLE_TEXT_OPACITY = 0.6

const ACTION_LABEL: Record<TimerStatus, string> = {
  idle: 'Start timer',
  running: 'Pause timer',
  paused: 'Resume timer',
}

const useTimerElapsed = (status: TimerStatus): number => {
  const [elapsedMs, setElapsedMs] = useState(() => elapsedMsOf(useTimerStore.getState()))

  useEffect(() => {
    const sync = () => {
      setElapsedMs(elapsedMsOf(useTimerStore.getState()))
    }
    sync()
    if (status !== 'running') return
    const id = setInterval(sync, DISPLAY_TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [status])

  return elapsedMs
}

const useColonBlink = (active: boolean): boolean => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!active) {
      setVisible(true)
      return
    }
    const id = setInterval(() => {
      setVisible((v) => !v)
    }, BLINK_HALF_PERIOD_MS)
    return () => {
      clearInterval(id)
    }
  }, [active])

  return visible
}

const borderStyle = (status: TimerStatus): { borderWidth: number; borderColor?: string } => {
  if (status === 'running') {
    return { borderWidth: TIMER_STATE_BORDER_WIDTH, borderColor: TIMER_BORDER_COLORS.running }
  }
  if (status === 'paused') {
    return { borderWidth: TIMER_STATE_BORDER_WIDTH, borderColor: TIMER_BORDER_COLORS.paused }
  }
  return { borderWidth: 0 }
}

const TimerWidget = ({ width, height, dayMode = false }: TimerWidgetProps) => {
  const status = useTimerStore((s) => s.status)
  const toggle = useTimerStore((s) => s.toggle)
  const reset = useTimerStore((s) => s.reset)

  const elapsedMs = useTimerElapsed(status)
  const colonVisible = useColonBlink(status === 'paused')
  const text = formatTimerElapsed(elapsedMs, colonVisible)

  const fontSize = timerFontSize(height)
  const color = widgetTextColor(dayMode)

  return (
    <Pressable
      style={[styles.container, { width, height }, borderStyle(status)]}
      onPress={toggle}
      onLongPress={reset}
      delayLongPress={TIMER_LONG_PRESS_MS}
      accessibilityRole="button"
      accessibilityLabel={ACTION_LABEL[status]}
      accessibilityHint="Long press to reset"
      accessibilityState={{ busy: status === 'running' }}
      accessibilityValue={{ text }}
    >
      <Text
        style={{
          fontSize,
          fontWeight: '700',
          color,
          opacity: status === 'idle' ? IDLE_TEXT_OPACITY : 1,
        }}
      >
        {text}
      </Text>
    </Pressable>
  )
}

export default React.memo(TimerWidget)

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
