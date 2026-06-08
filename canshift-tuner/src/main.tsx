// main.tsx — CANShift Tuner SPA entry point.
//
// BrowserRouter (not HashRouter) because Vercel serves the SPA from a real
// domain with the `vercel.json` rewrite catching unknown paths and falling
// through to index.html. No firmware-route table to honour — that constraint
// was a canshift-studio-web concern.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
