import '../global.css'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import Navigation from './navigation'
import { Toaster } from '@/components/ui'
import { useBleForegroundReconnect } from '@/hooks/use-ble-foreground-reconnect'

export default function App() {
  useBleForegroundReconnect()
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
      <Toaster />
    </SafeAreaProvider>
  )
}
