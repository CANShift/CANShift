import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { TIMER_BORDER_COLORS } from '@tmbk/canshift-core'
import { Colors, Radius, Spacing, TabularNums, Typography } from '../../theme'
import type { SessionLap } from '../../lib/timer-laps'
import { formatTimerElapsed } from '../widgets/widget-value'

export interface LapListProps {
  laps: readonly SessionLap[]
}

const bestLapIndex = (laps: readonly SessionLap[]): number | null => {
  const first = laps[0]
  if (laps.length < 2 || first === undefined) return null
  return laps.reduce((best, lap) => (lap.lapMs < best.lapMs ? lap : best), first).index
}

const LapRow = ({ lap, isBest }: { lap: SessionLap; isBest: boolean }) => (
  <View style={styles.row}>
    <Text style={styles.index}>{`L${String(lap.index)}`}</Text>
    <Text style={[styles.lapTime, isBest && styles.best]}>
      {formatTimerElapsed(lap.lapMs, true)}
    </Text>
    <Text style={styles.total}>{formatTimerElapsed(lap.totalMs, true)}</Text>
  </View>
)

const LapList = ({ laps }: LapListProps) => {
  const best = bestLapIndex(laps)
  const newestFirst = [...laps].reverse()

  if (laps.length === 0) {
    return <Text style={styles.empty}>No laps yet — tap Lap while the timer is running.</Text>
  }

  return (
    <FlatList
      data={newestFirst}
      keyExtractor={(lap) => String(lap.index)}
      renderItem={({ item }) => <LapRow lap={item} isBest={item.index === best} />}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  )
}

export default React.memo(LapList)

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: Spacing.xs },
  row: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  index: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: '700',
    width: 40,
  },
  lapTime: {
    color: Colors.text,
    fontSize: Typography.md,
    fontVariant: TabularNums,
    fontWeight: '600',
  },
  best: { color: TIMER_BORDER_COLORS.running },
  total: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontVariant: TabularNums,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
})
