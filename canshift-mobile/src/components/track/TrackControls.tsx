import { View } from 'react-native'
import { Button } from '@/components/ui'

export interface TrackControlsProps {
  active: boolean
  startFinishSet: boolean
  canSetStartFinish: boolean
  onToggleTrackMode: () => void
  onSetStartFinish: () => void
}

export const TrackControls = ({
  active,
  startFinishSet,
  canSetStartFinish,
  onToggleTrackMode,
  onSetStartFinish,
}: TrackControlsProps) => (
  <View className="gap-2">
    <Button
      variant={active ? 'destructive' : 'default'}
      onPress={onToggleTrackMode}
      accessibilityLabel={active ? 'Stop track mode' : 'Start track mode'}
    >
      {active ? 'Stop track mode' : 'Start track mode'}
    </Button>
    <Button
      variant="outline"
      disabled={!canSetStartFinish}
      onPress={onSetStartFinish}
      accessibilityLabel="Set start/finish line"
    >
      {startFinishSet ? 'Reset start/finish line' : 'Set start/finish line'}
    </Button>
  </View>
)
