import { useDeviceStore } from '../../stores/device.store'
import { FlashSection } from './FlashSection'

export const DeviceSection = () => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const portPath = useDeviceStore((s) => s.portPath)

  const status = connected && !simulationMode ? 'done' : 'active'

  return (
    <FlashSection step={1} title="Device" status={status}>
      {connected && !simulationMode ? (
        <p>
          Tuner is talking to the dash on <strong>{portPath ?? 'the active port'}</strong>. The
          flasher reuses this connection — no second port selection needed.
        </p>
      ) : (
        <p>
          No device connected. The flasher needs an active WebSerial link to the dash. Connect via
          the Welcome screen, then come back here.
        </p>
      )}
    </FlashSection>
  )
}
