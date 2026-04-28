// TopBar.tsx — Application top navigation bar

import { NavLink } from 'react-router-dom'
import csLogo from '../../assets/cs-logo.png'

const navItems = [
  { to: '/editor', label: 'Editor' },
  { to: '/signals', label: 'Signals' },
  { to: '/theme', label: 'Theme' },
  { to: '/device', label: 'Device' },
]

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    background: '#0D0D0D',
    borderBottom: '1px solid #2A2A2A',
    padding: '0 16px',
    gap: 8,
    WebkitAppRegion: 'drag' as const,
  } as React.CSSProperties,
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginRight: 24,
    WebkitAppRegion: 'no-drag' as const,
  } as React.CSSProperties,
  logoImg: {
    height: 28,
    width: 28,
    objectFit: 'contain' as const,
  } as React.CSSProperties,
  logoText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#FF4444',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  nav: {
    display: 'flex',
    gap: 4,
    WebkitAppRegion: 'no-drag' as const,
  } as React.CSSProperties,
}

export default function TopBar() {
  return (
    <header style={styles.bar}>
      <div style={styles.logoWrap}>
        <img src={csLogo} alt="CANShift" style={styles.logoImg} />
        <span style={styles.logoText}>CANShift Studio</span>
      </div>
      <nav style={styles.nav}>
        {navItems.map(({ to, label }) => (
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
              transition: 'all 0.1s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
