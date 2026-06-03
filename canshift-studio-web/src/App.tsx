// App.tsx — Dash-hosted Studio root.
//
// Mounts a single lazy editor route. The Electron App.tsx orchestrates the
// CLI panel, error/version banners, burn dialogs, first-run modal and a
// full route table — none of those ship in the web build. Anything kept here
// either belongs to the renderer-only editor surface, or coordinates the
// dash-hosted connection lifecycle (connect screen → device config fetch).

import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import TopBar from './components/shared/TopBar'
import { useDeviceStore } from './stores/device.store'
import { useDashboardStore } from './stores/dashboard.store'
import { useConnectionStore } from './stores/connection.store'
import { useLogStore } from './stores/log.store'
import { DEFAULT_SIM_CONFIG } from './config/defaultSimConfig'
import { deviceIpc } from './transport'

// Connection target when served from the dash itself: same host, fixed port.
const DEVICE_WS_PORT = 81

// Lazy editor — keep Canvas/WidgetPalette/PropertyPanel out of the initial paint.
const EditorRoute = lazy(() => import('./routes/EditorRoute'))

function RouteLoading() {
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

/**
 * Auto-route on first paint: dev builds (`vite dev`) enter simulation so the
 * editor mounts against the demo config; production builds (served from the
 * dash over WiFi) auto-connect to the same host on the device WS port. Drops
 * the prior ConnectScreen empty-state — the choice is determined by where
 * the SPA is being served from, not by a user prompt.
 */
function useAutoBootstrap(): void {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const connect = useConnectionStore((s) => s.connect)

  useEffect(() => {
    if (connected || simulationMode) return
    if (import.meta.env.DEV) {
      enterSimulation()
    } else {
      void connect(window.location.hostname, DEVICE_WS_PORT).catch(() => {
        // Connection failures surface via TopBar status — no auto-fallback to
        // sim because masking a real connection issue would be worse UX than
        // leaving the loading state visible while the user investigates.
      })
    }
  }, [connected, simulationMode, enterSimulation, connect])
}

/**
 * One-shot bootstrap: when simulation flips on for the first time and the
 * dashboard store has no config, seed it with the demo so the editor mounts.
 */
function useSimulationBootstrap(): void {
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const hasConfig = useDashboardStore((s) => s.config !== null)
  const setConfig = useDashboardStore((s) => s.setConfig)

  useEffect(() => {
    if (simulationMode && !hasConfig) {
      setConfig(structuredClone(DEFAULT_SIM_CONFIG))
    }
  }, [simulationMode, hasConfig, setConfig])
}

/**
 * On every connect transition, ask the dash for its config and feed the
 * dashboard store. Falls back to the demo when the device reports no
 * persisted config so the editor mounts in a usable state.
 */
function useDeviceConfigBootstrap(): void {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const loadFromDeviceOrDemo = useDashboardStore((s) => s.loadFromDeviceOrDemo)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || transport !== 'wifi') return
    let cancelled = false
    void deviceIpc
      .getConfig()
      .then((result) => {
        if (cancelled) return
        if (result.kind === 'ok') {
          const outcome = loadFromDeviceOrDemo(result.config)
          if (outcome === 'device') log('success', 'Loaded config from dash')
        } else if (result.kind === 'none') {
          const outcome = loadFromDeviceOrDemo(null)
          if (outcome === 'demo') log('info', 'Dash has no config — loaded demo')
        } else {
          log('error', `Failed to read dash config: ${result.error}`)
        }
      })
      .catch((err: unknown) => {
        // #1288 WS-7 — a transient WS failure between connect and the first
        // `getConfig` ack used to fall through unhandled. Surface it via the
        // log store so the user sees something instead of a silent loading
        // spinner with a stack trace in the console.
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        log('error', `Failed to read dash config: ${message}`)
      })
    return () => {
      cancelled = true
    }
  }, [connected, transport, loadFromDeviceOrDemo, log])
}

export default function App() {
  useAutoBootstrap()
  useSimulationBootstrap()
  useDeviceConfigBootstrap()

  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const ready = connected || simulationMode

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'hsl(var(--bg))',
        color: 'hsl(var(--text))',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <TopBar />
      {ready ? (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/editor" replace />} />
              <Route
                path="/editor"
                element={
                  <Suspense fallback={<RouteLoading />}>
                    <EditorRoute />
                  </Suspense>
                }
              />
            </Routes>
          </div>
        </main>
      ) : (
        <RouteLoading />
      )}
    </div>
  )
}
