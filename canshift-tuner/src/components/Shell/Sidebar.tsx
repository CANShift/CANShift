import { NavLink, useLocation } from 'react-router-dom'
import { Sidebar as UiSidebar } from '@tmbk/canshift-ui'
import type { SidebarLinkProps } from '@tmbk/canshift-ui'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'
import { useUiStore } from '../../stores/ui.store'

const RouterLink = ({ to, style, children, title }: SidebarLinkProps) => (
  <NavLink to={to} end={to === '/'} style={style} title={title}>
    {children}
  </NavLink>
)

export default function Sidebar() {
  const status = useConnectionStore((s) => s.status)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const location = useLocation()
  const offline = status !== 'connected' && !simulationMode

  return (
    <UiSidebar
      activeRoute={location.pathname}
      offline={offline}
      collapsed={collapsed}
      onToggleCollapse={toggleSidebar}
      LinkComponent={RouterLink}
    />
  )
}
