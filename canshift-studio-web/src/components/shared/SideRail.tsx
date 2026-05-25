// SideRail.tsx — Minimal dash-hosted side rail (phase 1, #1104). The Electron
// version surfaced the firmware update dot via `useDeviceStore.firmwareCheck`
// and rendered animated burn-phase indicators; the spike strips both.

import { NavLink } from 'react-router-dom'

interface RailLink {
  to: string
  label: string
}

const LINKS: RailLink[] = [
  { to: '/editor', label: 'Editor' },
]

export default function SideRail() {
  return (
    <nav
      style={{
        width: 56,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderRight: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        gap: 4,
      }}
    >
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            width: 44,
            padding: '8px 0',
            textAlign: 'center',
            fontSize: 10,
            color: isActive ? 'hsl(var(--text))' : 'hsl(var(--text-muted))',
            background: isActive ? 'hsl(var(--surface-2))' : 'transparent',
            borderRadius: 4,
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          })}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
