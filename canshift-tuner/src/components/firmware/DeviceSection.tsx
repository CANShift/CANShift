import { useDeviceStore } from '../../stores/device.store'
import { FlashSection } from './FlashSection'
import { IdentifyChipButton } from './IdentifyChipButton'

export const DeviceSection = () => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const portPath = useDeviceStore((s) => s.portPath)

  const status = connected && !simulationMode ? 'done' : 'active'

  return (
    <FlashSection step={1} title="Device" status={status}>
      {connected && !simulationMode ? (
        <p>
          Tuner is talking to the dash on <strong>{portPath ?? 'the active port'}</strong>. To
          identify the chip, the flasher needs its own ROM-bootloader handshake — pick the same port
          when the browser prompts. Tuner reconnects on its own afterwards.
        </p>
      ) : (
        <p>
          No active tuner connection. Identifying the chip here is still safe — the flasher asks the
          browser for a port, syncs with the ROM bootloader, then releases it.
        </p>
      )}
      <IdentifyChipButton />
    </FlashSection>
  )
}
