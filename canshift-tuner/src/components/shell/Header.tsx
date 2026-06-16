import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HeaderView, type HeaderStatus } from './HeaderView'
import { BurnButton as UiBurnButton } from './BurnButton'
import { FirmwareSlot as UiFirmwareSlot } from './FirmwareSlot'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'
import { useBurnDashboard } from '../../hooks/useBurnDashboard'
import { deviceEvents } from '../../transport'

const PULSE_HOLD_MS = 220
const PULSE_THROTTLE_MS = 60

interface PortLike {
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

const readPortLabel = (port: PortLike | null): string | null => {
  if (!port) return null
  try {
    const info = port.getInfo()
    const vendor = info.usbVendorId
    const product = info.usbProductId
    if (vendor === undefined && product === undefined) return null
    const vendorHex = vendor !== undefined ? vendor.toString(16).padStart(4, '0') : '????'
    const productHex = product !== undefined ? product.toString(16).padStart(4, '0') : '????'
    return `${vendorHex}:${productHex}`
  } catch {
    return null
  }
}

const useSerialActivityPulse = (active: boolean): boolean => {
  const [pulsing, setPulsing] = useState(false)
  const lastTickRef = useRef(0)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearOffTimer = () => {
      if (offTimerRef.current !== null) {
        clearTimeout(offTimerRef.current)
        offTimerRef.current = null
      }
    }

    if (!active) {
      setPulsing(false)
      clearOffTimer()
      return () => {}
    }

    const unsubscribe = deviceEvents.onActivity(() => {
      const now = performance.now()
      if (now - lastTickRef.current < PULSE_THROTTLE_MS) return
      lastTickRef.current = now
      setPulsing(true)
      clearOffTimer()
      offTimerRef.current = setTimeout(() => {
        setPulsing(false)
        offTimerRef.current = null
      }, PULSE_HOLD_MS)
    })

    return () => {
      unsubscribe()
      clearOffTimer()
      setPulsing(false)
    }
  }, [active])

  return pulsing
}

const SECTION_TITLES: Record<string, string> = {
  '/': 'Welcome',
  '/dashboard': 'Dashboard',
  '/live-data': 'Live Data',
  '/ecu': 'ECU Profile',
  '/can-bus': 'CAN Bus',
  '/obd2': 'OBD-II',
  '/cli': 'CLI',
  '/logs': 'Logs',
  '/themes': 'Themes',
  '/firmware': 'Firmware',
  '/about': 'About',
}

const sectionTitleFromPath = (pathname: string): string | null => {
  const exact = SECTION_TITLES[pathname]
  if (exact !== undefined) return exact
  const prefixMatch = Object.keys(SECTION_TITLES).find(
    (path) => path !== '/' && pathname.startsWith(`${path}/`)
  )
  return prefixMatch !== undefined ? (SECTION_TITLES[prefixMatch] ?? null) : null
}

const Header = () => {
  const status = useConnectionStore((s) => s.status)
  const port = useConnectionStore((s) => s.port)
  const disconnect = useConnectionStore((s) => s.disconnect)
  const location = useLocation()
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const exitSimulation = useDeviceStore((s) => s.exitSimulation)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCompat = useDeviceStore((s) => s.firmwareCompat)
  const pulsing = useSerialActivityPulse(status === 'connected' && !simulationMode)
  const portLabel = !simulationMode && status === 'connected' ? readPortLabel(port) : null

  const resolvedStatus: HeaderStatus = simulationMode ? 'simulation' : status

  const handleDisconnect = () => {
    if (simulationMode) {
      exitSimulation()
    } else {
      disconnect()
    }
  }

  const section = sectionTitleFromPath(location.pathname)
  const title =
    section !== null && section !== 'Welcome' ? `CANShift Tuner › ${section}` : 'CANShift Tuner'

  return (
    <HeaderView
      title={title}
      tunerVersion={__TUNER_VERSION__}
      status={resolvedStatus}
      portLabel={portLabel}
      activityPulse={pulsing}
      firmwareSlot={<UiFirmwareSlot version={firmwareVersion} compat={firmwareCompat} />}
      burnButton={<BurnButton />}
      onDisconnect={handleDisconnect}
    />
  )
}

const BurnButton = () => {
  const { canBurn, isBurning, burn } = useBurnDashboard()
  const title = isBurning
    ? 'Burning dashboard to the device…'
    : canBurn
      ? 'Burn dashboard to device (Cmd/Ctrl+S)'
      : 'Connect a device and edit the dashboard to enable Burn'
  return (
    <UiBurnButton
      disabled={!canBurn}
      busy={isBurning}
      title={title}
      onClick={() => {
        void burn()
      }}
    />
  )
}

export default Header
