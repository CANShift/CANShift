import '../global.css'
import React, { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import Navigation from './navigation'
import { Toaster } from '@/components/ui'
import { useBleForegroundReconnect } from '@/hooks/use-ble-foreground-reconnect'
import { markFirstScreenReady } from './diag/cold-start'

export default function App() {
  useBleForegroundReconnect()
  useEffect(() => {
    // Fires after the first commit — the earliest moment the user sees pixels.
    markFirstScreenReady()
  }, [])
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
      <Toaster />
    </SafeAreaProvider>
  )
}
