import { Text, View } from 'react-native'
import { Card, SectionLabel } from '@/components/ui'
import { formatLapMs, LAP_TIME_PLACEHOLDER } from '@/lib/lap-time'

export interface LapStatsProps {
  lastLapMs: number | null
  bestLapMs: number | null
}

const statText = (ms: number | null): string =>
  ms === null ? LAP_TIME_PLACEHOLDER : formatLapMs(ms)

export const LapStats = ({ lastLapMs, bestLapMs }: LapStatsProps) => (
  <View className="flex-row gap-2">
    <Card className="flex-1 items-center gap-1">
      <SectionLabel>Last</SectionLabel>
      <Text className="text-xl font-semibold tabular-nums text-text">{statText(lastLapMs)}</Text>
    </Card>
    <Card className="flex-1 items-center gap-1">
      <SectionLabel>Best</SectionLabel>
      <Text className="text-xl font-semibold tabular-nums text-success">{statText(bestLapMs)}</Text>
    </Card>
  </View>
)
