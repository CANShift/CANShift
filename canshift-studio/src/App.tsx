// App.tsx — Root component and route definitions

import { Routes, Route, Navigate } from 'react-router-dom'
import EditorRoute from './routes/EditorRoute'
import SignalRoute from './routes/SignalRoute'
import UpdateRoute from './routes/UpdateRoute'
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import ConnectScreen from './components/shared/ConnectScreen'
import ConsolePanel from './components/shared/ConsolePanel'
import StatusBar from './components/shared/StatusBar'
import UpdateBanner from './components/shared/UpdateBanner'
import { useMenuEvents } from './hooks/useMenuEvents'
import { useFirmwareCheck } from './hooks/useFirmwareCheck'
import { useDeviceStore } from './stores/device.store'
import FirmwareDialog from './components/shared/FirmwareDialog'

export default function App() {
  useMenuEvents()
  useFirmwareCheck()

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
              <Route path="/update" element={<UpdateRoute />} />
            </Routes>
          </div>
        </main>
      ) : (
        <ConnectScreen />
      )}

      <ConsolePanel />
      <StatusBar />
      <UpdateBanner />
      <FirmwareDialog />
    </div>
  )
}
