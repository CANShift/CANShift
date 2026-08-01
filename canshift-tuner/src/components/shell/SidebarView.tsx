import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { MONO_FONT } from '../../lib/typography'

export type SidebarRoute =
  | '/'
  | '/dashboard'
  | '/can'
  | '/ecu'
  | '/obd2'
  | '/themes'
  | '/live'
  | '/logs'
  | '/cli'
  | '/firmware'
  | '/about'

interface NavItem {
  to: SidebarRoute
  label: string
  alwaysOn?: boolean
}

interface NavGroup {
  label: string | null
  items: readonly NavItem[]
}

export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { label: null, items: [{ to: '/', label: 'Welcome', alwaysOn: true }] },
  {
    label: 'DASHBOARD',
    items: [
      { to: '/dashboard', label: 'Pages & widgets' },
      { to: '/themes', label: 'Themes' },
    ],
  },
  {
    label: 'VEHICLE',
    items: [
      { to: '/can', label: 'CAN bus' },
      { to: '/ecu', label: 'ECU profile' },
      { to: '/obd2', label: 'OBD-II' },
    ],
  },
  {
    label: 'DIAGNOSTICS',
    items: [
      { to: '/live', label: 'Live data' },
      { to: '/logs', label: 'Logs' },
      { to: '/cli', label: 'CLI' },
    ],
  },
  {
    label: 'DEVICE',
    items: [
      { to: '/firmware', label: 'Firmware' },
      { to: '/about', label: 'About' },
    ],
  },
]

const SIDEBAR_WIDTH = 236

export interface SidebarLinkProps {
  to: string
  style: CSSProperties
  className?: string | undefined
  children: ReactNode
  title?: string
}

export interface SidebarViewProps {
  activeRoute: string
  offline: boolean
  targetLabel: string | null
  firmwareVersion: string | null
  LinkComponent?: ComponentType<SidebarLinkProps>
}

const DefaultLink: ComponentType<SidebarLinkProps> = ({
  to,
  style,
  className,
  children,
  title,
}) => (
  <a href={to} style={style} className={className} title={title}>
    {children}
  </a>
)

export const SidebarView = ({
  activeRoute,
  offline,
  targetLabel,
  firmwareVersion,
  LinkComponent = DefaultLink,
}: SidebarViewProps) => (
  <nav aria-label="Primary" style={navStyle}>
    <div style={scrollAreaStyle}>
      {SIDEBAR_GROUPS.map((group, groupIdx) => (
        <div key={group.label ?? 'top'}>
          {group.label !== null && (
            <div style={groupIdx === 1 ? firstGroupLabelStyle : groupLabelStyle}>{group.label}</div>
          )}
          {group.items.map((item) => (
            <SidebarItem
              key={item.to}
              item={item}
              active={activeRoute === item.to}
              disabled={offline && item.alwaysOn !== true}
              LinkComponent={LinkComponent}
            />
          ))}
        </div>
      ))}
    </div>
    <div style={footerStyle}>
      <div style={footerRowStyle}>
        <span>TARGET</span>
        <span style={footerValueStyle}>{targetLabel ?? '—'}</span>
      </div>
      <div style={footerRowStyle}>
        <span>FIRMWARE</span>
        <span style={footerValueStyle}>
          {firmwareVersion !== null ? `v${firmwareVersion}` : '—'}
        </span>
      </div>
    </div>
  </nav>
)

interface SidebarItemProps {
  item: NavItem
  active: boolean
  disabled: boolean
  LinkComponent: ComponentType<SidebarLinkProps>
}

const SidebarItem = ({ item, active, disabled, LinkComponent }: SidebarItemProps) => {
  if (disabled) {
    return (
      <div
        role="link"
        tabIndex={0}
        aria-disabled="true"
        aria-label={`${item.label} — connect a device to access this section`}
        title="Connect a device to access this section"
        style={disabledItemStyle}
      >
        {item.label}
      </div>
    )
  }
  return (
    <LinkComponent
      to={item.to}
      style={active ? activeItemStyle : itemStyle}
      className={active ? undefined : 'shell-nav-item'}
    >
      {active && <span aria-hidden="true" style={activeBarStyle} />}
      {item.label}
    </LinkComponent>
  )
}

const navStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  background: 'hsl(var(--brand-neutral-100))',
  borderRight: '2px solid var(--brand-divider)',
  display: 'flex',
  flexDirection: 'column',
}

const scrollAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 0',
}

const groupLabelStyle: CSSProperties = {
  padding: '22px 18px 8px',
  fontWeight: 800,
  fontSize: 9,
  letterSpacing: '0.22em',
  color: 'hsl(var(--brand-neutral-600))',
}

const firstGroupLabelStyle: CSSProperties = {
  ...groupLabelStyle,
  paddingTop: 14,
}

const itemStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '9px 18px 9px 21px',
  fontSize: 13,
  textDecoration: 'none',
  color: 'hsl(var(--brand-neutral-700))',
}

const activeItemStyle: CSSProperties = {
  ...itemStyle,
  background: 'hsl(var(--brand-neutral-200))',
  color: 'hsl(var(--brand-text))',
  fontWeight: 800,
}

const disabledItemStyle: CSSProperties = {
  ...itemStyle,
  color: 'hsl(var(--brand-neutral-500))',
  cursor: 'not-allowed',
}

const activeBarStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
  background: 'hsl(var(--brand-accent))',
}

const footerStyle: CSSProperties = {
  borderTop: '2px solid var(--brand-divider)',
  padding: '14px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const footerValueStyle: CSSProperties = {
  color: 'hsl(var(--brand-text))',
}
