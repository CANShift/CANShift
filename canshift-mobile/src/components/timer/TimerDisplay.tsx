import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { TIMER_BORDER_COLORS } from '@tmbk/canshift-core'
import { Colors, Radius, Spacing, Typography } from '../../theme'
import type { TimerStatus } from '../../stores/timer.store'
import { formatTimerElapsed } from '../widgets/widget-value'

export interface TimerDisplayProps {
  elapsedMs: number
  status: TimerStatus
  deviceSynced: boolean
}

const STATUS_LABEL: Record<TimerStatus, string> = {
  idle: 'READY',
  running: 'RUNNING',
  paused: 'PAUSED',
}

const statusColor = (status: TimerStatus): string => {
  if (status === 'running') return TIMER_BORDER_COLORS.running
  if (status === 'paused') return TIMER_BORDER_COLORS.paused
  return Colors.textMuted
}

const TimerDisplay = ({ elapsedMs, status, deviceSynced }: TimerDisplayProps) => (
  <View style={[styles.container, { borderColor: statusColor(status) }]}>
    <Text style={[styles.status, { color: statusColor(status) }]}>{STATUS_LABEL[status]}</Text>
    <Text style={styles.time} accessibilityRole="text">
      {formatTimerElapsed(elapsedMs, true)}
    </Text>
    <Text style={styles.source}>{deviceSynced ? 'SYNCED WITH DASH' : 'PHONE ONLY'}</Text>
  </View>
)

export default React.memo(TimerDisplay)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 2,
    gap: Spacing.xs,
    padding: Spacing.lg,
  },
  status: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  time: {
    color: Colors.text,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  source: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    letterSpacing: 0.8,
  },
})
