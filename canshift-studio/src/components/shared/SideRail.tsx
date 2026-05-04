// SideRail.tsx — Vertical icon navigation rail (Editor / Signals / Update)

import { NavLink } from 'react-router-dom'
import { IconEditor, IconSignals, IconFirmware, IconCanScanner, IconSettings } from '../icons/Icon'

const NAV_ITEMS = [
  { to: '/editor', label: 'Editor', Icon: IconEditor },
  { to: '/signals', label: 'Signals', Icon: IconSignals },
  { to: '/scanner', label: 'CAN', Icon: IconCanScanner },
  { to: '/update', label: 'Update', Icon: IconFirmware },
  { to: '/device-config', label: 'Device', Icon: IconSettings },
]

export default function SideRail() {
  return (
    <nav
      style={{
        width: 48,
        background: '#0D0D0D',
        borderRight: '1px solid #1E1E1E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        gap: 2,
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            width: 40,
            height: 44,
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isActive ? '#FFFFFF' : '#AAAAAA',
            background: isActive ? '#2A2A2A' : 'transparent',
            borderLeft: isActive ? '2px solid #FF4444' : '2px solid transparent',
            transition: 'all 0.1s',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={16} color={isActive ? '#FF4444' : '#AAAAAA'} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
