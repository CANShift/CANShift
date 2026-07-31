import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DashTopBar from '../components/DashTopBar'
import { LapChrono } from '../components/track/LapChrono'
import { LapList } from '../components/track/LapList'
import { LapStats } from '../components/track/LapStats'
import { TrackControls } from '../components/track/TrackControls'
import { Toast } from '../components/ui'
import { useCurrentLapMs } from '../hooks/use-current-lap-ms'
import { startFinishLineFromPosition } from '../lib/start-finish-line'
import { trackModeController } from '../services/track-mode-controller'
import { log } from '../stores/log.store'
import {
  armStartFinishLine,
  getLatestSample,
  useTrackSessionStore,
} from '../stores/track-session.store'
import { Colors, Spacing } from '../theme'

const START_FAILURE_MESSAGES = {
  permission_denied: 'Location permission is required for lap timing',
  gps_unavailable: 'GPS is unavailable on this device',
} as const

const TrackScreen = () => {
  const recording = useTrackSessionStore((s) => s.recording)
  const laps = useTrackSessionStore((s) => s.laps)
  const bestLapMs = useTrackSessionStore((s) => s.bestLapMs)
  const startFinishSet = useTrackSessionStore((s) => s.startFinishSet)
  const writeIndex = useTrackSessionStore((s) => s.writeIndex)
  const currentLapMs = useCurrentLapMs()
  const [busy, setBusy] = useState(false)

  const lastLap = laps[laps.length - 1]

  const handleToggleTrackMode = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (trackModeController.isActive()) {
        await trackModeController.stop()
        return
      }
      const result = await trackModeController.start()
      if (!result.started && result.reason !== 'cancelled') {
        Toast.show({ type: 'error', text1: START_FAILURE_MESSAGES[result.reason] })
      }
    } catch (err) {
      log('warn', `Track mode toggle failed — ${err instanceof Error ? err.message : String(err)}`)
      Toast.show({ type: 'error', text1: 'Track mode failed — try again' })
    } finally {
      setBusy(false)
    }
  }, [busy])

  const handleSetStartFinish = useCallback(() => {
    const sample = getLatestSample()
    if (sample === undefined) {
      Toast.show({ type: 'error', text1: 'Waiting for a GPS fix' })
      return
    }
    const { line, forwardBearingDeg } = startFinishLineFromPosition(sample)
    armStartFinishLine(line, { forwardBearingDeg })
    Toast.show({ type: 'success', text1: 'Start/finish line set' })
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TrackControls
          active={recording}
          startFinishSet={startFinishSet}
          canSetStartFinish={recording && writeIndex > 0}
          onToggleTrackMode={() => {
            void handleToggleTrackMode()
          }}
          onSetStartFinish={handleSetStartFinish}
        />
        <LapChrono elapsedMs={currentLapMs} running={recording} />
        <LapStats
          lastLapMs={lastLap?.durationMs ?? null}
          bestLapMs={bestLapMs > 0 ? bestLapMs : null}
        />
        <LapList laps={laps} bestLapMs={bestLapMs} />
      </ScrollView>
    </SafeAreaView>
  )
}

export default TrackScreen

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
})
