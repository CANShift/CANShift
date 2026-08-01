import '../global.css'
import React, { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import {
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/archivo'
import Navigation from './navigation'
import { Toaster } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useBleForegroundReconnect } from '@/hooks/use-ble-foreground-reconnect'
import { useAppSettingsStore } from '@/stores/app-settings.store'
import { hydrateTimerSessions } from '@/stores/timer-sessions.store'
import { markFirstScreenReady } from './diag/cold-start'

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  })
  useBleForegroundReconnect()
  useEffect(() => {
    void useAppSettingsStore.getState().hydrate()
    void hydrateTimerSessions()
    markFirstScreenReady()
  }, [])
  if (!fontsLoaded) return null
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Navigation />
      </ErrorBoundary>
      <Toaster />
    </SafeAreaProvider>
  )
}
