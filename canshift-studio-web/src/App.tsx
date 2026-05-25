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
import SideRail from './components/shared/SideRail'
import StatusBar from './components/shared/StatusBar'
import ConnectScreen from './components/shared/ConnectScreen'
import { useDeviceStore } from './stores/device.store'
import { useDashboardStore } from './stores/dashboard.store'
import { useLogStore } from './stores/log.store'
import { DEFAULT_SIM_CONFIG } from './config/defaultSimConfig'
import { deviceIpc } from './transport'

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
    void deviceIpc.getConfig().then((result) => {
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
    return () => {
      cancelled = true
    }
  }, [connected, transport, loadFromDeviceOrDemo, log])
}

export default function App() {
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
          <SideRail />
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
        <ConnectScreen />
      )}
      <StatusBar />
    </div>
  )
}
