// renderer/main.tsx — React app entry point
//
// A `?surface=cli` query string switches to the standalone CLI shell used by
// the detached BrowserWindow (issue #433). The same Vite entry / lazy chunk
// is reused so the bundle budget doesn't regress.

import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Lazy so the standalone shell shares the existing CliTerminal chunk.
const CliDetachedShell = lazy(() => import('./components/shared/CliDetachedShell'))

function isCliSurface(): boolean {
  // `URLSearchParams` is the simplest dependency-free way to peek at the URL
  // query without a router; the detached window has no other routes.
  const params = new URLSearchParams(window.location.search)
  return params.get('surface') === 'cli'
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

if (isCliSurface()) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Suspense
        fallback={
          <div style={{ background: '#0A0A0A', height: '100vh' }} aria-label="Loading CLI" />
        }
      >
        <CliDetachedShell />
      </Suspense>
    </React.StrictMode>
  )
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </React.StrictMode>
  )
}
