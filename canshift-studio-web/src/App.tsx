// App.tsx — Dash-hosted Studio root (phase 1, #1104).
//
// Mounts a single lazy editor route. The Electron App.tsx orchestrates the
// CLI panel, error/version banners, burn dialogs, first-run modal and a
// full route table — none of those ship in the spike. Anything kept here
// has to either (a) belong to the renderer-only editor surface, or (b) be
// a placeholder that exercises a comparable bundle weight.

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import StatusBar from './components/shared/StatusBar'
import ConnectScreen from './components/shared/ConnectScreen'
import { useDeviceStore } from './stores/device.store'
import { useDashboardStore } from './stores/dashboard.store'
import { useEffect } from 'react'
import { DEFAULT_SIM_CONFIG } from './config/defaultSimConfig'

// Lazy editor — same bundle-splitting intent as PR #1085 in Electron Studio:
// keep Canvas/WidgetPalette/PropertyPanel out of the initial paint.
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
 * Phase 3 swaps this for a real fetch against the dash.
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

export default function App() {
  useSimulationBootstrap()

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
