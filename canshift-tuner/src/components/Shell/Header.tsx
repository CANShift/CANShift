import { useEffect, useRef, useState } from 'react'
import {
  Header as UiHeader,
  BurnButton as UiBurnButton,
  FirmwareSlot as UiFirmwareSlot,
} from '@tmbk/canshift-ui'
import type { HeaderStatus } from '@tmbk/canshift-ui'
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
    if (!active) {
      setPulsing(false)
      return
    }
    const unsubscribe = deviceEvents.onActivity(() => {
      const now = performance.now()
      if (now - lastTickRef.current < PULSE_THROTTLE_MS) return
      lastTickRef.current = now
      setPulsing(true)
      if (offTimerRef.current !== null) clearTimeout(offTimerRef.current)
      offTimerRef.current = setTimeout(() => {
        setPulsing(false)
        offTimerRef.current = null
      }, PULSE_HOLD_MS)
    })
    return () => {
      unsubscribe()
      if (offTimerRef.current !== null) {
        clearTimeout(offTimerRef.current)
        offTimerRef.current = null
      }
      setPulsing(false)
    }
  }, [active])

  return pulsing
}

export default function Header() {
  const status = useConnectionStore((s) => s.status)
  const port = useConnectionStore((s) => s.port)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCompat = useDeviceStore((s) => s.firmwareCompat)
  const pulsing = useSerialActivityPulse(status === 'connected' && !simulationMode)
  const portLabel = !simulationMode && status === 'connected' ? readPortLabel(port) : null

  const resolvedStatus: HeaderStatus = simulationMode ? 'simulation' : status

  return (
    <UiHeader
      tunerVersion={__TUNER_VERSION__}
      status={resolvedStatus}
      portLabel={portLabel}
      activityPulse={pulsing}
      firmwareSlot={<UiFirmwareSlot version={firmwareVersion} compat={firmwareCompat} />}
      burnButton={<BurnButton />}
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
