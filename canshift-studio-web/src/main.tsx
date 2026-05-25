// main.tsx — Dash-hosted Studio entry point (phase 1, #1104).
//
// Plain Vite SPA entry. HashRouter is retained because phase 3 (#1105) will
// serve the bundle from a single firmware route and avoid the need for
// HTML5-history rewrites in the embedded WebServer.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </React.StrictMode>
)
