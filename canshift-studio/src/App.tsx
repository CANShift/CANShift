// App.tsx — Root component and route definitions

import { Routes, Route, Navigate } from 'react-router-dom'
import EditorRoute from './routes/EditorRoute'
import SignalRoute from './routes/SignalRoute'
import ThemeRoute from './routes/ThemeRoute'
import DeviceRoute from './routes/DeviceRoute'
import TopBar from './components/shared/TopBar'
import StatusBar from './components/shared/StatusBar'

export default function App() {
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

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<EditorRoute />} />
          <Route path="/signals" element={<SignalRoute />} />
          <Route path="/theme" element={<ThemeRoute />} />
          <Route path="/device" element={<DeviceRoute />} />
        </Routes>
      </main>

      <StatusBar />
    </div>
  )
}
