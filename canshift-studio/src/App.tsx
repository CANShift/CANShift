// App.tsx — Root component and route definitions

import { Routes, Route, Navigate } from 'react-router-dom'
import EditorRoute from './routes/EditorRoute'
import SignalRoute from './routes/SignalRoute'
import UpdateRoute from './routes/UpdateRoute'
import CanScannerRoute from './routes/CanScannerRoute'
import DeviceConfigRoute from './routes/DeviceConfigRoute'
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import ConnectScreen from './components/shared/ConnectScreen'
import ConsolePanel from './components/shared/ConsolePanel'
import StatusBar from './components/shared/StatusBar'
import ErrorBar from './components/shared/ErrorBar'
import UpdateBanner from './components/shared/UpdateBanner'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { useMenuEvents } from './hooks/useMenuEvents'
import { useFirmwareCheck } from './hooks/useFirmwareCheck'
import { useSessionRestore } from './hooks/useSessionRestore'
import { useDeviceStore } from './stores/device.store'
import FirmwareDialog from './components/shared/FirmwareDialog'
import PushDiffDialog from './components/shared/PushDiffDialog'

export default function App() {
  useMenuEvents()
  useFirmwareCheck()
  useSessionRestore()

  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)

  const ready = connected || simulationMode

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#111111',
        color: '#FFFFFF',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <TopBar />

      {ready ? (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <SideRail />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/editor" replace />} />
              <Route
                path="/editor"
                element={
                  <ErrorBoundary>
                    <EditorRoute />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/signals"
                element={
                  <ErrorBoundary>
                    <SignalRoute />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ErrorBoundary>
                    <CanScannerRoute />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/update"
                element={
                  <ErrorBoundary>
                    <UpdateRoute />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/device-config"
                element={
                  <ErrorBoundary>
                    <DeviceConfigRoute />
                  </ErrorBoundary>
                }
              />
            </Routes>
          </div>
        </main>
      ) : (
        <ConnectScreen />
      )}

      <ConsolePanel />
      <ErrorBar />
      <StatusBar />
      <UpdateBanner />
      <FirmwareDialog />
      <PushDiffDialog />
    </div>
  )
}
