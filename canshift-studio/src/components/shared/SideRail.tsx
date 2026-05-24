// SideRail.tsx — Vertical icon navigation rail

import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { IconEditor, IconSignals, IconCanScanner, IconFirmware, IconSettings } from '../icons/Icon'
import { useDeviceStore } from '../../stores/device.store'
import { ensureSpinKeyframes } from './PhaseIndicator'

// Chrome shades that do not yet map to a core design token. Kept as named
// constants so the planned token promotion (audit S-H-5, umbrella #1015) only
// has to swap one place per shade. Documented in PR body as follow-up.
const CHROME_BG = '#0A0A0A' // MIRROR: darker than --bg (#121212), used as nav chrome
const CHROME_BORDER = '#1A1A1A' // MIRROR: between --bg and --surface
const CHROME_DIVIDER = '#1E1E1E' // MIRROR: ≈ --surface (#1F1F1F)
const BRAND_RED = '#E03030' // MIRROR: darker variant of --primary (#FF4747)
const ICON_MUTED = '#555555' // MIRROR: between bg and --text-muted (#8F8F8F)

const TOP_ITEMS = [
  { to: '/editor', label: 'Editor', Icon: IconEditor },
  { to: '/signals', label: 'Signals', Icon: IconSignals },
  { to: '/scanner', label: 'CAN', Icon: IconCanScanner },
] as const

const BOTTOM_ITEMS = [
  { to: '/update', label: 'Firmware', Icon: IconFirmware },
  { to: '/device-config', label: 'Device', Icon: IconSettings },
] as const

interface NavItemProps {
  to: string
  label: string
  Icon: (props: { size?: number; color?: string }) => React.JSX.Element
  showAlert?: boolean
}

function NavItem({ to, label, Icon, showAlert = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={label}
      style={({ isActive }) => ({
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 8,
        textDecoration: 'none',
        color: isActive ? 'hsl(var(--text))' : ICON_MUTED,
        background: isActive ? CHROME_DIVIDER : 'transparent',
        borderLeft: isActive ? `2px solid ${BRAND_RED}` : '2px solid transparent',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={17} color={isActive ? BRAND_RED : ICON_MUTED} />
          {showAlert && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: BRAND_RED,
                boxShadow: `0 0 0 2px ${CHROME_BG}`,
                animation: 'canshift-pulse 1.6s ease-in-out infinite',
              }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function SideRail() {
  const firmwareCheckKind = useDeviceStore((s) => s.firmwareCheck.kind)
  const updateAlert =
    firmwareCheckKind === 'no_firmware' || firmwareCheckKind === 'update_available'

  useEffect(() => {
    if (updateAlert) ensureSpinKeyframes()
  }, [updateAlert])

  return (
    <nav
      style={{
        width: 52,
        background: CHROME_BG,
        borderRight: `1px solid ${CHROME_BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        flexShrink: 0,
      }}
    >
      {/* Top group — daily use */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {TOP_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      {/* Separator */}
      <div style={{ width: 24, height: 1, background: CHROME_DIVIDER, margin: '6px 0' }} />

      {/* Bottom group — hardware/setup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} showAlert={item.to === '/update' && updateAlert} />
        ))}
      </div>
    </nav>
  )
}
