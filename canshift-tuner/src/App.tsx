import { lazy, Suspense, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/shell/Header'
import Sidebar from './components/shell/Sidebar'
import FeedbackButton from './components/shell/FeedbackButton'
import { DeviceAlertBar } from './components/shell/DeviceAlertBar'
import WelcomeRoute from './routes/WelcomeRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useConnectionStore } from './stores/connection.store'
import { useDashboardStore } from './stores/dashboard.store'
import { useDeviceStore } from './stores/device.store'
import { useAutoReconnect } from './hooks/useAutoReconnect'
import { useSimulationBootstrap } from './hooks/useSimulationBootstrap'
import { useDeviceConfigBootstrap } from './hooks/useDeviceConfigBootstrap'
import { useVersionHandshake } from './hooks/useVersionHandshake'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useHeapStatsSubscription } from './hooks/useHeapStatsSubscription'
import { useFirmwareLogBridge } from './hooks/useFirmwareLogBridge'
import { useBurnShortcut } from './hooks/useBurnShortcut'
import { bootstrapProjects } from './stores/project/project.store'
import { useWidgetOverflowWarnings } from './hooks/useWidgetOverflowWarnings'
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
import { DeviceConfigConflictDialog } from './components/shell/DeviceConfigConflictDialog'
import { ROUTE_PATHS, type RoutePath } from './constants/routes'

const EditorRoute = lazy(() => import('./routes/EditorRoute'))
const AboutRoute = lazy(() => import('./routes/AboutRoute'))
const CanBusRoute = lazy(() => import('./routes/CanBusRoute'))
const CliRoute = lazy(() => import('./routes/CliRoute'))
const EcuRoute = lazy(() => import('./routes/EcuRoute'))
const FirmwareRoute = lazy(() => import('./routes/FirmwareRoute'))
const LiveDataRoute = lazy(() => import('./routes/LiveDataRoute'))
const LogsRoute = lazy(() => import('./routes/LogsRoute'))
const Obd2Route = lazy(() => import('./routes/Obd2Route'))
const ThemesRoute = lazy(() => import('./routes/ThemesRoute'))

const RouteLoading = () => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--text-dim))',
        fontSize: 12,
      }}
    >
      Loading…
    </div>
  )
}

const ROUTE_ELEMENTS: Record<RoutePath, ReactNode> = {
  '/': <WelcomeRoute />,
  '/dashboard': (
    <ErrorBoundary scope="editor">
      <EditorRoute />
    </ErrorBoundary>
  ),
  '/can': <CanBusRoute />,
  '/ecu': <EcuRoute />,
  '/obd2': <Obd2Route />,
  '/themes': <ThemesRoute />,
  '/live': <LiveDataRoute />,
  '/logs': <LogsRoute />,
  '/cli': <CliRoute />,
  '/firmware': <FirmwareRoute />,
  '/about': <AboutRoute />,
}

const DISCONNECTED_ALLOWED_PATHS = new Set(['/', '/firmware', '/about', '/logs', '/themes'])

const DisconnectedGuard = ({ children }: { children: ReactNode }) => {
  const status = useConnectionStore((s) => s.status)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const location = useLocation()
  if (
    status !== 'connected' &&
    status !== 'reconnecting' &&
    !simulationMode &&
    !DISCONNECTED_ALLOWED_PATHS.has(location.pathname)
  ) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const App = () => {
  useAutoReconnect()
  useSimulationBootstrap()
  useVersionHandshake()
  useHeartbeat()
  useHeapStatsSubscription()
  useFirmwareLogBridge()
  useDeviceConfigBootstrap()
  useBurnShortcut()
  useWidgetOverflowWarnings()
  useUnsavedChangesGuard()

  const hasDashboardConfig = useDashboardStore((s) => s.config !== null)
  useEffect(() => {
    bootstrapProjects()
  }, [hasDashboardConfig])

  return (
    <div style={shellStyle}>
      <Header />
      <DeviceAlertBar />
      <div style={bodyStyle}>
        <Sidebar />
        <main style={mainStyle}>
          <DisconnectedGuard>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                {ROUTE_PATHS.map((path) => (
                  <Route key={path} path={path} element={ROUTE_ELEMENTS[path]} />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </DisconnectedGuard>
        </main>
      </div>
      <FeedbackButton />
      <DeviceConfigConflictDialog />
    </div>
  )
}

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'hsl(var(--brand-chrome-bg))',
  color: 'hsl(var(--brand-text))',
  fontFamily: 'var(--font-ui)',
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
}

const mainStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

export default App
