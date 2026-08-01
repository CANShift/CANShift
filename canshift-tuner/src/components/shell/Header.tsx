import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HeaderView, type HeaderStatus } from './HeaderView'
import { BurnButton as UiBurnButton, BurnOutcomePill } from './BurnButton'
import { FirmwareSlot as UiFirmwareSlot } from './FirmwareSlot'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'
import { useUiStore } from '../../stores/ui.store'
import { useBurnDashboard } from '../../hooks/useBurnDashboard'
import { deviceEvents } from '../../transport'
import { ROUTE_PATHS, isRoutePath, type RoutePath } from '../../constants/routes'

const PULSE_HOLD_MS = 220
const PULSE_THROTTLE_MS = 60

const BURN_SUCCESS_FLASH_MS = 2_500
const BURN_ERROR_AUTO_CLEAR_MS = 8_000
const BURN_DENIED_SHAKE_MS = 400

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

export const SECTION_TITLES: Record<RoutePath, string> = {
  '/': 'Welcome',
  '/dashboard': 'Dashboard',
  '/live': 'Live Data',
  '/ecu': 'ECU Profile',
  '/can': 'CAN Bus',
  '/obd2': 'OBD-II',
  '/cli': 'CLI',
  '/logs': 'Logs',
  '/themes': 'Themes',
  '/firmware': 'Firmware',
  '/about': 'About',
}

const sectionTitleFromPath = (pathname: string): string | null => {
  if (isRoutePath(pathname)) return SECTION_TITLES[pathname]
  const prefixMatch = ROUTE_PATHS.find((path) => path !== '/' && pathname.startsWith(`${path}/`))
  return prefixMatch !== undefined ? SECTION_TITLES[prefixMatch] : null
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

  return (
    <HeaderView
      section={section !== null && section !== 'Welcome' ? section : null}
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

const useBurnOutcomeAutoClear = (): void => {
  const lastBurnResult = useDeviceStore((s) => s.lastBurnResult)
  const setLastBurnResult = useDeviceStore((s) => s.setLastBurnResult)
  useEffect(() => {
    if (lastBurnResult === null) return
    const delay =
      lastBurnResult.kind === 'success' ? BURN_SUCCESS_FLASH_MS : BURN_ERROR_AUTO_CLEAR_MS
    const timer = setTimeout(() => {
      setLastBurnResult(null)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [lastBurnResult, setLastBurnResult])
}

const useBurnDeniedShake = (): boolean => {
  const burnDeniedAt = useUiStore((s) => s.burnDeniedAt)
  const [shaking, setShaking] = useState(false)
  useEffect(() => {
    if (burnDeniedAt === null) return
    setShaking(true)
    const timer = setTimeout(() => {
      setShaking(false)
    }, BURN_DENIED_SHAKE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [burnDeniedAt])
  return shaking
}

const BurnButton = () => {
  const { canBurn, isBurning, burn } = useBurnDashboard()
  const lastBurnResult = useDeviceStore((s) => s.lastBurnResult)
  const setLastBurnResult = useDeviceStore((s) => s.setLastBurnResult)
  useBurnOutcomeAutoClear()
  const shaking = useBurnDeniedShake()

  const title = isBurning
    ? 'Burning dashboard to the device…'
    : canBurn
      ? 'Burn dashboard to device (Cmd/Ctrl+S)'
      : 'Connect a device and edit the dashboard to enable Burn'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {lastBurnResult === null ? null : lastBurnResult.kind === 'success' ? (
        <BurnOutcomePill kind="success" />
      ) : (
        <BurnOutcomePill
          kind="error"
          message={lastBurnResult.message}
          onDismiss={() => {
            setLastBurnResult(null)
          }}
        />
      )}
      <span
        style={{
          display: 'inline-flex',
          animation: shaking
            ? `canshift-tuner-shake ${BURN_DENIED_SHAKE_MS}ms ease-in-out`
            : undefined,
        }}
      >
        <UiBurnButton
          disabled={!canBurn}
          busy={isBurning}
          title={title}
          onClick={() => {
            void burn()
          }}
        />
      </span>
    </span>
  )
}

export default Header
