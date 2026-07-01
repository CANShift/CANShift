import { useState, useCallback } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../theme'
import { clearBuffer } from '../stores/telemetry.store'
import DashTopBar from '../components/DashTopBar'
import { ChartPanel, type ChartPanelProps } from '../components/graph/ChartPanel'
import type { SignalKey } from '../constants/ble'

const DEFAULT_SIGNALS: SignalKey[] = ['r', 'lam']

export default function GraphScreen() {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [windowSecs, setWindowSecs] = useState(30)
  const [visibleSignals, setVisibleSignals] = useState<SignalKey[]>(DEFAULT_SIGNALS)

  const handleTogglePause = useCallback(() => {
    setPausedAt((current) => (current === null ? Date.now() : null))
  }, [])

  const handleToggleSignal = useCallback((key: SignalKey) => {
    setVisibleSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const panelProps: ChartPanelProps = {
    visibleSignals,
    windowSecs,
    paused: pausedAt !== null,
    pausedAt: pausedAt ?? 0,
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
