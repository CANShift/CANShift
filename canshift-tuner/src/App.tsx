// App.tsx — Betaflight-style Tuner shell (Header + Sidebar + Routes outlet).
//
// Editor is lazy because it pulls Canvas + widget palette into its chunk.
// First paint while disconnected forces the user back to Welcome — the
// connect handshake happens there, and every other section gates on a live
// device.

import { lazy, Suspense, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/Shell/Header'
import Sidebar from './components/Shell/Sidebar'
import PlaceholderRoute from './components/Shell/PlaceholderRoute'
import WelcomeRoute from './routes/WelcomeRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useConnectionStore } from './stores/connection.store'

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
 * Re-use an already-authorized port from a previous session. Fires once on
 * mount — the connection store internally short-circuits if no port has been
 * granted yet.
 */
function useAutoReconnect(): void {
  useEffect(() => {
    void useConnectionStore.getState().tryAutoReconnect()
  }, [])
}

/**
 * Redirect every non-Welcome path back to `/` while disconnected. The Sidebar
 * already blocks the UI path, but a direct URL hit (or a reload mid-session)
 * still needs to be intercepted.
 */
function DisconnectedGuard({ children }: { children: ReactNode }) {
  const status = useConnectionStore((s) => s.status)
  const location = useLocation()
  if (status !== 'connected' && location.pathname !== '/') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function App() {
  useAutoReconnect()

  return (
    <div style={shellStyle}>
      <Header />
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
              <Route path="/can" element={<PlaceholderRoute label="CAN Bus" icon="⇄" />} />
              <Route path="/obd2" element={<PlaceholderRoute label="OBD-II" icon="⚙" />} />
              <Route path="/themes" element={<PlaceholderRoute label="Themes" icon="◐" />} />
              <Route path="/live" element={<PlaceholderRoute label="Live Data" icon="▤" />} />
              <Route path="/logs" element={<PlaceholderRoute label="Logs" icon="☰" />} />
              <Route path="/cli" element={<PlaceholderRoute label="CLI" icon="›_" />} />
              <Route
                path="/firmware"
                element={
                  <PlaceholderRoute
                    label="Firmware"
                    icon="⏏"
                    subtext="Flasher coming in a follow-up PR"
                  />
                }
              />
              <Route path="/about" element={<PlaceholderRoute label="About" icon="ⓘ" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DisconnectedGuard>
        </main>
      </div>
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
