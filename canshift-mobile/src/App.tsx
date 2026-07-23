import '../global.css'
import React, { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import Navigation from './navigation'
import { Toaster } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useBleForegroundReconnect } from '@/hooks/use-ble-foreground-reconnect'
import { useAppSettingsStore } from '@/stores/app-settings.store'
import { markFirstScreenReady } from './diag/cold-start'

export default function App() {
  useBleForegroundReconnect()
  useEffect(() => {
    void useAppSettingsStore.getState().hydrate()
    markFirstScreenReady()
  }, [])
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
