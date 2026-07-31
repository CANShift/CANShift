import { Text, View } from 'react-native'
import { Card, SectionLabel } from '@/components/ui'
import { formatLapMs } from '@/lib/lap-time'
import type { LapRecord } from '@/stores/track-session.store'

export interface LapListProps {
  laps: readonly LapRecord[]
  bestLapMs: number
}

export const LapList = ({ laps, bestLapMs }: LapListProps) => (
  <Card className="gap-2">
    <SectionLabel>Laps</SectionLabel>
    {laps.length === 0 ? (
      <Text className="text-sm text-text-muted">No laps yet</Text>
    ) : (
      [...laps].reverse().map((lap) => {
        const isBest = lap.durationMs === bestLapMs
        return (
          <View key={lap.number} className="flex-row items-center justify-between">
            <Text className="text-sm text-text-dim">Lap {lap.number}</Text>
            <Text
              className={`text-base font-medium tabular-nums ${isBest ? 'text-success' : 'text-text'}`}
            >
              {formatLapMs(lap.durationMs)}
            </Text>
          </View>
        )
      })
    )}
  </Card>
)
