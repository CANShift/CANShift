// TopBar.tsx — Application top navigation bar

import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useDeviceStore } from '../../stores/device.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'

const navItems = [
  { to: '/editor', label: 'Editor' },
  { to: '/signals', label: 'Signals' },
  { to: '/theme', label: 'Theme' },
]

const DOT_COLOR: Record<string, string> = {
  connected: '#44CC44',
  burning: '#FF8800',
  error: '#CC3333',
  disconnected: '#444444',
}

const LABEL: Record<string, string> = {
  connected: 'Connected',
  burning: 'Burning…',
  error: 'Error',
  disconnected: 'No Device',
}

const toolbarBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  background: 'transparent',
  border: '1px solid #2A2A2A',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 12,
  color: '#888888',
  transition: 'all 0.1s',
  WebkitAppRegion: 'no-drag',
} as React.CSSProperties

export default function TopBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const status = useDeviceStore((s) => s.status)

  const { openConfig, saveConfig, burnConfig, config, connected, syncing } = useConfigActions()

  const dotColor = DOT_COLOR[status] ?? '#444444'
  const label = LABEL[status] ?? 'No Device'

  const canSave = config !== null
  const canBurn = config !== null && connected && !syncing

  return (
    <>
      <header
        style={
          {
            display: 'flex',
            alignItems: 'center',
            height: 48,
            background: '#0D0D0D',
            borderBottom: '1px solid #2A2A2A',
            padding: '0 16px 0 80px',
            gap: 8,
            WebkitAppRegion: 'drag',
            flexShrink: 0,
          } as React.CSSProperties
        }
      >
        {/* App name */}
        <span
          style={
            {
              fontSize: 14,
              fontWeight: 700,
              color: '#FF4444',
              letterSpacing: '0.05em',
              marginRight: 24,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
        >
          CANShift Studio
        </span>

        {/* Nav links */}
        <nav
          style={{ display: 'flex', gap: 4, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {navItems.map(({ to, label: navLabel }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                padding: '4px 12px',
                borderRadius: 4,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#FFFFFF' : '#888888',
                background: isActive ? '#2A2A2A' : 'transparent',
              })}
            >
              {navLabel}
            </NavLink>
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Toolbar actions */}
        <div
          style={
            {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
        >
          {/* Load */}
          <button onClick={openConfig} style={toolbarBtn} title="Open config file">
            Load
          </button>

          {/* Export / Save */}
          <button
            onClick={saveConfig}
            disabled={!canSave}
            style={{ ...toolbarBtn, opacity: canSave ? 1 : 0.35 }}
            title="Save config file"
          >
            Export
          </button>

          {/* Burn */}
          <button
            onClick={burnConfig}
            disabled={!canBurn}
            style={{
              ...toolbarBtn,
              opacity: canBurn ? 1 : 0.35,
              color: canBurn ? '#FF8800' : '#888888',
              borderColor: canBurn ? '#3A2200' : '#2A2A2A',
            }}
            title="Push config to device"
          >
            {syncing ? 'Burning…' : 'Burn'}
          </button>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: '#2A2A2A' }} />

          {/* Connect */}
          <button
            onClick={() => {
              setModalOpen((o) => !o)
            }}
            style={{
              ...toolbarBtn,
              background: modalOpen ? '#2A2A2A' : 'transparent',
              borderColor: modalOpen ? '#3A3A3A' : '#2A2A2A',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColor,
                boxShadow: status !== 'disconnected' ? `0 0 5px ${dotColor}99` : 'none',
                flexShrink: 0,
              }}
            />
            <span style={{ color: status === 'disconnected' ? '#555555' : '#CCCCCC' }}>
              {label}
            </span>
          </button>
        </div>
      </header>

      {modalOpen && (
        <ConnectModal
          onClose={() => {
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
