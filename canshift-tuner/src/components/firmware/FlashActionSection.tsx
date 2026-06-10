import { Button } from '@/components/ui/button'
import { FlashSection } from './FlashSection'

export const FlashActionSection = () => (
  <FlashSection step={3} title="Flash" status="disabled">
    <p>
      Erase the flash, write the new firmware, verify the checksum, then reboot into the freshly
      written image. The dash is unreachable for ~30 seconds during the flow.
    </p>
    <div>
      <Button type="button" variant="default" size="default" disabled>
        Flash firmware (coming soon)
      </Button>
    </div>
  </FlashSection>
)
