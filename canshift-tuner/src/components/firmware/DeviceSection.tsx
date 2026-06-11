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
          Tuner is on <strong>{portPath ?? 'the active port'}</strong>. The flasher releases this
          connection automatically when you click Flash, reuses the same port handle, then leaves
          the dash disconnected once the new firmware is running. Reconnect via Welcome to resume.
        </p>
      ) : (
        <p>
          No active tuner connection. Click Flash and pick the dash port when the browser prompts —
          the flasher syncs the ROM bootloader and releases the port afterwards.
        </p>
      )}
    </FlashSection>
  )
}
