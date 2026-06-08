// TopBar.tsx — Minimal dash-hosted shell top bar.
//
// Drops the connect/disconnect + simulation toggle affordances (env-driven via
// `useAutoBootstrap` in App.tsx). The only persistence button surfaced here is
// `Burn` — push the current dashboard config to the live dash over the WS
// transport. Disabled when nothing is connected, no config is loaded, or a
// burn is in flight.

import { useState } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { useLogStore } from '../../stores/log.store'
import { usbService } from '../../transport'

const BAR_HEIGHT = 36

export default function TopBar() {
  const config = useDashboardStore((s) => s.config)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const filePath = useDashboardStore((s) => s.filePath)
  const connected = useDeviceStore((s) => s.connected)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const log = useLogStore((s) => s.push)
  const [burning, setBurning] = useState(false)

  const burnEnabled = connected && config !== null && !burning

  const handleBurn = async () => {
    if (!config) return
    setBurning(true)
    const result = await usbService.pushConfig(config)
    setBurning(false)
    if (result.success) {
      log('success', 'Config burned to dash')
      // markSaved clears `isDirty` so the StatusBar drops the ● indicator.
      // Re-use the existing filePath so the action signature is honoured —
      // dash transport has no real file backing so an empty string is fine.
      markSaved(filePath ?? '')
    } else {
      log('error', `Burn failed: ${result.error ?? 'unknown error'}`)
    }
  }

  return (
    <header
      style={{
        height: BAR_HEIGHT,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text))' }}>
        CANShift Studio
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'hsl(var(--text-muted))',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Web
      </div>
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10,
          color: 'hsl(var(--text-dim))',
          fontFamily: 'monospace',
          letterSpacing: '0.04em',
        }}
        title={
          firmwareVersion
            ? `Studio ${__STUDIO_VERSION__} · Dash ${firmwareVersion}`
            : `Studio ${__STUDIO_VERSION__} · Dash offline`
        }
      >
        studio {__STUDIO_VERSION__} · dash {firmwareVersion ?? '—'}
      </span>
      <button
        type="button"
        onClick={() => {
          void handleBurn()
        }}
        disabled={!burnEnabled}
        title={
          !connected
            ? 'Burn requires a connected dash'
            : !config
              ? 'Load a dashboard before burning'
              : isDirty
                ? 'Push current dashboard to the dash'
                : 'No unsaved changes — burn anyway?'
        }
        style={{
          background: '#CC3333',
          color: '#FFFFFF',
          border: '1px solid #A82828',
          borderRadius: 4,
          padding: '4px 14px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: burnEnabled ? 'pointer' : 'not-allowed',
          opacity: burnEnabled ? 1 : 0.4,
        }}
      >
        {burning ? 'Burning…' : 'Burn'}
      </button>
    </header>
  )
}
