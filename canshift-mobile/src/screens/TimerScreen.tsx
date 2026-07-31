import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, Spacing, Typography } from '../theme'
import DashTopBar from '../components/DashTopBar'
import TimerDisplay from '../components/timer/TimerDisplay'
import TimerControls from '../components/timer/TimerControls'
import LapList from '../components/timer/LapList'
import { useTimerStore } from '../stores/timer.store'
import { hydrateTimerSessions } from '../stores/timer-sessions.store'
import { timerControl } from '../services/timer-control'
import { useTimerElapsed } from '../hooks/use-timer-elapsed'

export default function TimerScreen() {
  const status = useTimerStore((s) => s.status)
  const laps = useTimerStore((s) => s.laps)
  const deviceSynced = useTimerStore((s) => s.deviceSynced)
  const elapsedMs = useTimerElapsed(status)

  useEffect(() => {
    void hydrateTimerSessions()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />
      <View style={styles.body}>
        <TimerDisplay elapsedMs={elapsedMs} status={status} deviceSynced={deviceSynced} />
        <TimerControls
          status={status}
          onStart={timerControl.start}
          onPause={timerControl.pause}
          onResume={timerControl.resume}
          onReset={timerControl.reset}
          onLap={timerControl.lap}
        />
        <Text style={styles.lapsTitle}>LAPS</Text>
        <LapList laps={laps} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  lapsTitle: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
})
