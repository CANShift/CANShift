import { Button } from '@/components/ui/button'
import type { FirmwareSelection } from '../../stores/firmware-selection.store'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { FlashSection } from './FlashSection'

const labelFor = (selection: FirmwareSelection): string => {
  if (selection.kind === 'release') return `Flash ${selection.release.tag} (coming soon)`
  if (selection.kind === 'local') return `Flash ${selection.firmware.name} (coming soon)`
  return 'Flash firmware'
}

export const FlashActionSection = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const status = selection.kind === 'none' ? 'disabled' : 'active'

  return (
    <FlashSection step={3} title="Flash" status={status}>
      <p>
        Erase the flash, write the new firmware, verify the checksum, then reboot into the freshly
        written image. The dash is unreachable for ~30 seconds during the flow.
      </p>
      <div>
        <Button type="button" variant="default" size="default" disabled>
          {labelFor(selection)}
        </Button>
      </div>
    </FlashSection>
  )
}
