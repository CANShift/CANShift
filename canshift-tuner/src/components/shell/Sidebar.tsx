import { NavLink, useLocation } from 'react-router-dom'
import { resolveScreenProfile } from '@tmbk/canshift-core'
import { SidebarView, type SidebarLinkProps } from './SidebarView'
import { useConnectionStore } from '../../stores/connection.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'

const RouterLink = ({ to, style, className, children, title }: SidebarLinkProps) => (
  <NavLink to={to} end={to === '/'} style={style} className={className ?? ''} title={title}>
    {children}
  </NavLink>
)

const Sidebar = () => {
  const status = useConnectionStore((s) => s.status)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const targetProfile = useDashboardStore((s) => s.config?.targetProfile)
  const location = useLocation()
  const offline = status !== 'connected' && !simulationMode
  const targetLabel = resolveScreenProfile(targetProfile).name

  return (
    <SidebarView
      activeRoute={location.pathname}
      offline={offline}
      targetLabel={targetLabel}
      firmwareVersion={firmwareVersion}
      LinkComponent={RouterLink}
    />
  )
}

export default Sidebar
