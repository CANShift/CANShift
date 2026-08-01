import type { ComponentType, CSSProperties, ReactNode } from 'react'

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
  icon: string
  alwaysOn?: boolean
}

interface Divider {
  divider: true
}

type Entry = NavItem | Divider

export const SIDEBAR_ENTRIES: readonly Entry[] = [
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

const SIDEBAR_WIDTH = 200
const COLLAPSED_WIDTH = 52

export interface SidebarLinkProps {
  to: string
  style: CSSProperties
  children: ReactNode
  title?: string
}

export interface SidebarViewProps {
  activeRoute: string
  offline: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  LinkComponent?: ComponentType<SidebarLinkProps>
}

const DefaultLink: ComponentType<SidebarLinkProps> = ({ to, style, children, title }) => (
  <a href={to} style={style} title={title}>
    {children}
  </a>
)

export const SidebarView = ({
  activeRoute,
  offline,
  collapsed = false,
  onToggleCollapse,
  LinkComponent = DefaultLink,
}: SidebarViewProps) => {
  return (
    <nav
      aria-label="Primary"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderRight: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '8px 0',
        transition: 'width 180ms ease',
      }}
    >
      {SIDEBAR_ENTRIES.map((entry, idx) => {
        if ('divider' in entry) {
          return (
            <div
              key={`divider-${String(idx)}`}
              aria-hidden="true"
              style={{
                height: 1,
                margin: collapsed ? '8px 14px' : '8px 12px',
                background: 'hsl(var(--border))',
              }}
            />
          )
        }
        const disabled = offline && entry.alwaysOn !== true
        const active = activeRoute === entry.to
        return (
          <SidebarItem
            key={entry.to}
            item={entry}
            active={active}
            disabled={disabled}
            collapsed={collapsed}
            LinkComponent={LinkComponent}
          />
        )
      })}
      <div style={{ flex: 1 }} />
      {onToggleCollapse && <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />}
    </nav>
  )
}

interface SidebarItemProps {
  item: NavItem
  active: boolean
  disabled: boolean
  collapsed: boolean
  LinkComponent: ComponentType<SidebarLinkProps>
}

const SidebarItem = ({ item, active, disabled, collapsed, LinkComponent }: SidebarItemProps) => {
  const baseStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '8px 0' : '8px 16px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: 13,
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'background 100ms ease, color 100ms ease',
  }

  const iconNode = (
    <span
      aria-hidden="true"
      style={{ width: 16, textAlign: 'center', fontSize: 13, flexShrink: 0 }}
    >
      {item.icon}
    </span>
  )

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        title={
          collapsed
            ? `${item.label} — connect a device first`
            : 'Connect a device to access this section'
        }
        style={{
          ...baseStyle,
          color: 'hsl(var(--text-muted))',
          opacity: 0.4,
          cursor: 'not-allowed',
        }}
      >
        {iconNode}
        {!collapsed && <span>{item.label}</span>}
      </div>
    )
  }

  const linkStyle: CSSProperties = {
    ...baseStyle,
    color: active ? 'hsl(var(--text))' : 'hsl(var(--text-dim))',
    background: active ? 'hsl(var(--surface-2))' : 'transparent',
    borderLeftColor: active ? 'hsl(var(--brand-accent))' : 'transparent',
    fontWeight: active ? 600 : 400,
  }

  if (collapsed) {
    return (
      <LinkComponent to={item.to} style={linkStyle} title={item.label}>
        {iconNode}
      </LinkComponent>
    )
  }

  return (
    <LinkComponent to={item.to} style={linkStyle}>
      {iconNode}
      <span>{item.label}</span>
    </LinkComponent>
  )
}

interface CollapseToggleProps {
  collapsed: boolean
  onToggle: () => void
}

const CollapseToggle = ({ collapsed, onToggle }: CollapseToggleProps) => {
  const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 0',
    margin: 0,
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid hsl(var(--border))',
    color: 'hsl(var(--text-muted))',
    fontSize: 14,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <button
      type="button"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-pressed={collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={onToggle}
      style={buttonStyle}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
        {collapsed ? '›' : '‹'}
      </span>
      {!collapsed && <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>COLLAPSE</span>}
    </button>
  )
}
