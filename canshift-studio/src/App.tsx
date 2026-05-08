// App.tsx — Root component and route definitions

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import EditorRoute from './routes/EditorRoute'

// Secondary routes — code-split so the editor's first paint isn't blocked on
// signal mapping, CAN scanner, firmware updater, or device config bundles.
const SignalRoute = lazy(() => import('./routes/SignalRoute'))
const UpdateRoute = lazy(() => import('./routes/UpdateRoute'))
const CanScannerRoute = lazy(() => import('./routes/CanScannerRoute'))
const DeviceConfigRoute = lazy(() => import('./routes/DeviceConfigRoute'))

function RouteLoading() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#444444',
        fontSize: 12,
      }}
    >
      Loading…
    </div>
  )
}
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import ConnectScreen from './components/shared/ConnectScreen'
import ConsolePanel from './components/shared/ConsolePanel'
import StatusBar from './components/shared/StatusBar'
import ErrorBar from './components/shared/ErrorBar'
import UpdateBanner from './components/shared/UpdateBanner'
import VersionMismatchBanner from './components/shared/VersionMismatchBanner'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { useMenuEvents } from './hooks/useMenuEvents'
import { useFirmwareCheck } from './hooks/useFirmwareCheck'
import { useSessionRestore } from './hooks/useSessionRestore'
import { useAutoConnect } from './hooks/useAutoConnect'
import { useDeviceConfigLoad } from './hooks/useDeviceConfigLoad'
import { useDirtySync } from './hooks/useDirtySync'
import { useBurnPhaseTracker } from './hooks/useBurnPhaseTracker'
import { useDeviceStore } from './stores/device.store'
import PushDiffDialog from './components/shared/PushDiffDialog'
import BurnProgressModal from './components/shared/BurnProgressModal'
import WelcomeModal from './components/shared/WelcomeModal'
import { useFirstRunCheck } from './hooks/useFirstRunCheck'
import { Toaster } from './components/ui/sonner'

export default function App() {
  useMenuEvents()
  useFirmwareCheck()
  useDeviceConfigLoad()
  useSessionRestore()
  useAutoConnect()
  useDirtySync()
  useBurnPhaseTracker()

  const firstRun = useFirstRunCheck()
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
                    <Suspense fallback={<RouteLoading />}>
                      <SignalRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <CanScannerRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/update"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <UpdateRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/device-config"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <DeviceConfigRoute />
                    </Suspense>
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
      <VersionMismatchBanner />
      <PushDiffDialog />
      <BurnProgressModal />
      {firstRun.state === 'pending' && <WelcomeModal onDismiss={firstRun.markCompleted} />}
      <Toaster />
    </div>
  )
}
