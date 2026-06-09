// Sidebar.tsx — Left navigation in the Betaflight-style shell.
//
// Section entries below are the source of truth for the shell menu; route
// definitions in App.tsx must stay in sync. When the device is not connected
// only the Welcome entry is reachable — every other entry is greyed out and
// blocks click-through so the user can't navigate past the connect handshake.

import type { CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'

const SIDEBAR_WIDTH = 200

interface NavItem {
  to: string
  label: string
  icon: string
  /** When true, accessible even while disconnected (Welcome / About). */
  alwaysOn?: boolean
}

interface Divider {
  divider: true
}

type Entry = NavItem | Divider

const ENTRIES: Entry[] = [
  { to: '/', label: 'Welcome', icon: '⚡', alwaysOn: true },
  { divider: true },
  { to: '/dashboard', label: 'Dashboard', icon: '◉' },
  { to: '/can', label: 'CAN Bus', icon: '⇄' },
  { to: '/ecu', label: 'ECU Profile', icon: '⚛' },
  { to: '/obd2', label: 'OBD-II', icon: '⚙' },
  { to: '/themes', label: 'Themes', icon: '◐' },
  { divider: true },
  { to: '/live', label: 'Live Data', icon: '▤' },
  { to: '/logs', label: 'Logs', icon: '☰' },
  { to: '/cli', label: 'CLI', icon: '›_' },
  { divider: true },
  { to: '/firmware', label: 'Firmware', icon: '⏏' },
  { to: '/about', label: 'About', icon: 'ⓘ' },
]

export default function Sidebar() {
  const status = useConnectionStore((s) => s.status)
  // Treat dev-mode simulation as a "live device" for navigation gating —
  // mirrors App.tsx's DisconnectedGuard so the two stay aligned.
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const location = useLocation()
  const offline = status !== 'connected' && !simulationMode

  return (
    <nav
      aria-label="Primary"
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderRight: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '8px 0',
      }}
    >
      {ENTRIES.map((entry, idx) => {
        if ('divider' in entry) {
          return (
            <div
              key={`divider-${idx}`}
              aria-hidden="true"
              style={{
                height: 1,
                margin: '8px 12px',
                background: 'hsl(var(--border))',
              }}
            />
          )
        }
        const disabled = offline && entry.alwaysOn !== true
        const active = location.pathname === entry.to
        return (
          <SidebarItem
            key={entry.to}
            item={entry}
            active={active}
            disabled={disabled}
          />
        )
      })}
    </nav>
  )
}

interface SidebarItemProps {
  item: NavItem
  active: boolean
  disabled: boolean
}

function SidebarItem({ item, active, disabled }: SidebarItemProps) {
  const baseStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    fontSize: 13,
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'background 100ms ease, color 100ms ease',
  }

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        title="Connect a device to access this section"
        style={{
          ...baseStyle,
          color: 'hsl(var(--text-muted))',
          opacity: 0.4,
          cursor: 'not-allowed',
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 16, textAlign: 'center', fontSize: 13 }}
        >
          {item.icon}
        </span>
        <span>{item.label}</span>
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      style={{
        ...baseStyle,
        color: active ? 'hsl(var(--text))' : 'hsl(var(--text-dim))',
        background: active ? 'hsl(var(--surface-2))' : 'transparent',
        borderLeftColor: active ? 'hsl(var(--primary))' : 'transparent',
        fontWeight: active ? 600 : 400,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 16, textAlign: 'center', fontSize: 13 }}
      >
        {item.icon}
      </span>
      <span>{item.label}</span>
    </NavLink>
  )
}
