import { useState, useCallback } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../theme'
import { clearBuffer } from '../stores/telemetry.store'
import DashTopBar from '../components/DashTopBar'
import { ChartPanel, type ChartPanelProps } from '../components/graph/ChartPanel'

const DEFAULT_SIGNALS = ['r', 'lam']

export default function GraphScreen() {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const [windowSecs, setWindowSecs] = useState(30)
  const [visibleSignals, setVisibleSignals] = useState<string[]>(DEFAULT_SIGNALS)

  const handleTogglePause = useCallback(() => {
    setPaused((p) => {
      if (!p) setPausedAt(Date.now())
      return !p
    })
  }, [])

  const handleToggleSignal = useCallback((key: string) => {
    setVisibleSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const panelProps: ChartPanelProps = {
    visibleSignals,
    windowSecs,
    paused,
    pausedAt,
    onTogglePause: handleTogglePause,
    onSetWindow: setWindowSecs,
    onClear: clearBuffer,
    onToggleSignal: handleToggleSignal,
    compact: isLandscape,
  }

  return (
    <SafeAreaView style={styles.container}>
      <DashTopBar />
      <ChartPanel {...panelProps} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
})
