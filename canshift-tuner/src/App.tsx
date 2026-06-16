import { lazy, Suspense, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/shell/Header'
import Sidebar from './components/shell/Sidebar'
import FeedbackButton from './components/shell/FeedbackButton'
import { DeviceAlertBar } from './components/shell/DeviceAlertBar'
import WelcomeRoute from './routes/WelcomeRoute'
import AboutRoute from './routes/AboutRoute'
import CanBusRoute from './routes/CanBusRoute'
import CliRoute from './routes/CliRoute'
import EcuRoute from './routes/EcuRoute'
import FirmwareRoute from './routes/FirmwareRoute'
import LiveDataRoute from './routes/LiveDataRoute'
import LogsRoute from './routes/LogsRoute'
import Obd2Route from './routes/Obd2Route'
import ThemesRoute from './routes/ThemesRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useConnectionStore } from './stores/connection.store'
import { useDeviceStore } from './stores/device.store'
import { useDashboardStore } from './stores/dashboard.store'
import { useLogStore } from './stores/log.store'
import type { LogLevel } from './stores/log.store'
import { useFlasherStore } from './stores/flasher.store'
import { DEFAULT_SIM_CONFIG } from './config/default-sim-config'
import { deviceEvents, deviceIpc, usbService } from './transport'

const HEARTBEAT_INTERVAL_MS = 5_000
const HEARTBEAT_MISS_THRESHOLD = 3
import { useBurnDashboard } from './hooks/useBurnDashboard'

const EditorRoute = lazy(() => import('./routes/EditorRoute'))

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

const useAutoReconnect = (): void => {
  useEffect(() => {
    void useConnectionStore.getState().tryAutoReconnect()
  }, [])
}

const useSimulationBootstrap = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const flasherKind = useFlasherStore((s) => s.state.kind)
  const hasConfig = useDashboardStore((s) => s.config !== null)
  const setConfig = useDashboardStore((s) => s.setConfig)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (connected || simulationMode) return
    if (flasherKind === 'flashing') return
    enterSimulation()
  }, [connected, simulationMode, flasherKind, enterSimulation])

  useEffect(() => {
    if (simulationMode && !hasConfig) {
      setConfig(structuredClone(DEFAULT_SIM_CONFIG))
    }
  }, [simulationMode, hasConfig, setConfig])
}

const useDeviceConfigBootstrap = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const loadFromDeviceOrDemo = useDashboardStore((s) => s.loadFromDeviceOrDemo)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || transport !== 'usb') return
    let cancelled = false
    void deviceIpc
      .getConfig()
      .then((result) => {
        if (cancelled) return
        if (result.kind === 'ok') {
          const outcome = loadFromDeviceOrDemo(result.config)
          if (outcome === 'device') log('success', 'Loaded config from device')
        } else if (result.kind === 'none') {
          const outcome = loadFromDeviceOrDemo(null)
          if (outcome === 'demo') log('info', 'Device has no config — loaded demo')
        } else {
          log('error', `Failed to read device config: ${result.error}`)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        log('error', `Failed to read device config: ${message}`)
      })
    return () => {
      cancelled = true
    }
  }, [connected, transport, loadFromDeviceOrDemo, log])
}

const useVersionHandshake = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setFirmwareVersion = useDeviceStore((s) => s.setFirmwareVersion)
  const setFirmwareCompat = useDeviceStore((s) => s.setFirmwareCompat)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') return
    let cancelled = false
    void usbService.queryVersion().then((result) => {
      if (cancelled) return
      if (result.kind === 'error') {
        log('warn', `Version handshake failed: ${result.error}`)
        setFirmwareCompat({ kind: 'unknown' })
        return
      }
      const { version, protocol, isDay } = result.identity
      setFirmwareVersion(version)
      setIsDayMode(isDay)
      const reportedMajor = Number(version.split('.')[0] ?? 0)
      if (reportedMajor !== __EXPECTED_FIRMWARE_MAJOR__) {
        log(
          'error',
          `Firmware major mismatch — tuner expects ${String(__EXPECTED_FIRMWARE_MAJOR__)}.x, device reports ${version}. Burn disabled.`
        )
        setFirmwareCompat({
          kind: 'mismatch',
          expected: __EXPECTED_FIRMWARE_MAJOR__,
          got: reportedMajor,
          version,
        })
        return
      }
      setFirmwareCompat({ kind: 'compatible', protocol })
      log('success', `Connected to firmware v${version} (proto ${String(protocol)})`)
    })
    return () => {
      cancelled = true
    }
  }, [
    connected,
    simulationMode,
    transport,
    setFirmwareVersion,
    setFirmwareCompat,
    setIsDayMode,
    log,
  ])
}

const useHeartbeat = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setFirmwareLiveness = useDeviceStore((s) => s.setFirmwareLiveness)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') {
      setFirmwareLiveness({ kind: 'unknown' })
      return
    }
    let cancelled = false
    let missed = 0
    let unresponsiveLogged = false
    let firstMissedAt: number | null = null

    const probe = async () => {
      const result = await usbService.ping()
      if (cancelled) return
      if (result.kind === 'ok') {
        missed = 0
        firstMissedAt = null
        unresponsiveLogged = false
        setFirmwareLiveness({
          kind: 'alive',
          lastPongAt: Date.now(),
          uptimeMs: result.uptimeMs,
        })
        return
      }
      missed += 1
      if (firstMissedAt === null) firstMissedAt = Date.now()
      if (missed >= HEARTBEAT_MISS_THRESHOLD) {
        setFirmwareLiveness({
          kind: 'unresponsive',
          missedPings: missed,
          sinceMs: firstMissedAt,
        })
        if (!unresponsiveLogged) {
          log('error', `Firmware unresponsive — ${String(missed)} pings missed (${result.error})`)
          unresponsiveLogged = true
        }
      }
    }

    void probe()
    const id = window.setInterval(() => {
      void probe()
    }, HEARTBEAT_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
      setFirmwareLiveness({ kind: 'unknown' })
    }
  }, [connected, simulationMode, transport, setFirmwareLiveness, log])
}

const useHeapStatsSubscription = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const pushHeapStats = useDeviceStore((s) => s.pushHeapStats)
  const clearHeapStats = useDeviceStore((s) => s.clearHeapStats)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') return
    clearHeapStats()
    const unsubscribe = deviceEvents.onHeapStats((entry) => {
      pushHeapStats(entry)
    })
    return unsubscribe
  }, [connected, simulationMode, transport, pushHeapStats, clearHeapStats])
}

const FIRMWARE_LEVEL_MAP: Record<string, LogLevel> = {
  E: 'error',
  W: 'warn',
  I: 'info',
  D: 'debug',
  V: 'debug',
}

const useFirmwareLogBridge = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') return
    const push = useLogStore.getState().push
    const unsubscribe = deviceEvents.onLogLine(({ level, tag, message }) => {
      const mapped = FIRMWARE_LEVEL_MAP[level] ?? 'info'
      push(mapped, message, tag)
    })
    return unsubscribe
  }, [connected, simulationMode, transport])
}

const useBurnShortcut = (): void => {
  const { canBurn, burn } = useBurnDashboard()
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key !== 's') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (!canBurn) return
      void burn()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [canBurn, burn])
}

const DISCONNECTED_ALLOWED_PATHS = new Set([
  '/',
  '/firmware',
  '/about',
  '/logs',
  '/themes',
])

const DisconnectedGuard = ({ children }: { children: ReactNode }) => {
  const status = useConnectionStore((s) => s.status)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const location = useLocation()
  if (
    status !== 'connected' &&
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

  return (
    <div style={shellStyle}>
      <Header />
      <DeviceAlertBar />
      <div style={bodyStyle}>
        <Sidebar />
        <main style={mainStyle}>
          <DisconnectedGuard>
            <Routes>
              <Route path="/" element={<WelcomeRoute />} />
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary scope="editor">
                    <Suspense fallback={<RouteLoading />}>
                      <EditorRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route path="/can" element={<CanBusRoute />} />
              <Route path="/ecu" element={<EcuRoute />} />
              <Route path="/obd2" element={<Obd2Route />} />
              <Route path="/themes" element={<ThemesRoute />} />
              <Route path="/live" element={<LiveDataRoute />} />
              <Route path="/logs" element={<LogsRoute />} />
              <Route path="/cli" element={<CliRoute />} />
              <Route path="/firmware" element={<FirmwareRoute />} />
              <Route path="/about" element={<AboutRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DisconnectedGuard>
        </main>
      </div>
      <FeedbackButton />
    </div>
  )
}

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'hsl(var(--bg))',
  color: 'hsl(var(--text))',
  fontFamily: 'system-ui, sans-serif',
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
