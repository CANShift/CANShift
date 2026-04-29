// App.tsx — Root component and route definitions

import { Routes, Route, Navigate } from 'react-router-dom'
import EditorRoute from './routes/EditorRoute'
import SignalRoute from './routes/SignalRoute'
import ThemeRoute from './routes/ThemeRoute'
import UpdateRoute from './routes/UpdateRoute'
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import ConnectScreen from './components/shared/ConnectScreen'
import ConsolePanel from './components/shared/ConsolePanel'
import StatusBar from './components/shared/StatusBar'
import { useMenuEvents } from './hooks/useMenuEvents'
import { useDeviceStore } from './stores/device.store'

export default function App() {
  useMenuEvents()

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
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/editor" replace />} />
              <Route path="/editor" element={<EditorRoute />} />
              <Route path="/signals" element={<SignalRoute />} />
              <Route path="/theme" element={<ThemeRoute />} />
              <Route path="/update" element={<UpdateRoute />} />
            </Routes>
          </div>
        </main>
      ) : (
        <ConnectScreen />
      )}

      <ConsolePanel />
      <StatusBar />
    </div>
  )
}
