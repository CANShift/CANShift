import { Button } from '@/components/ui/button'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { FlashSection } from './FlashSection'

export const FlashActionSection = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const status = selection.kind === 'local' ? 'active' : 'disabled'
  const buttonLabel =
    selection.kind === 'local' ? `Flash ${selection.firmware.name} (coming soon)` : 'Flash firmware'

  return (
    <FlashSection step={3} title="Flash" status={status}>
      <p>
        Erase the flash, write the new firmware, verify the checksum, then reboot into the freshly
        written image. The dash is unreachable for ~30 seconds during the flow.
      </p>
      <div>
        <Button type="button" variant="default" size="default" disabled>
          {buttonLabel}
        </Button>
      </div>
    </FlashSection>
  )
}
