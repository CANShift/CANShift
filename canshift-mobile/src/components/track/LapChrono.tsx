import { Text } from 'react-native'
import { Card, SectionLabel } from '@/components/ui'
import { formatLapMs, LAP_TIME_PLACEHOLDER } from '@/lib/lap-time'

export interface LapChronoProps {
  elapsedMs: number
  running: boolean
}

export const LapChrono = ({ elapsedMs, running }: LapChronoProps) => (
  <Card className="items-center gap-1">
    <SectionLabel>Current lap</SectionLabel>
    <Text
      className={`text-5xl font-bold tabular-nums ${running ? 'text-text' : 'text-text-muted'}`}
      accessibilityLabel="Current lap time"
    >
      {running ? formatLapMs(elapsedMs) : LAP_TIME_PLACEHOLDER}
    </Text>
  </Card>
)
