import { FirmwareScreen } from '../components/firmware/FirmwareScreen'
import { DeviceSection } from '../components/firmware/DeviceSection'
import { FirmwareSection } from '../components/firmware/FirmwareSection'
import { FlashActionSection } from '../components/firmware/FlashActionSection'

const FirmwareRoute = () => (
  <FirmwareScreen
    deviceSection={<DeviceSection />}
    firmwareSection={<FirmwareSection />}
    flashSection={<FlashActionSection />}
  />
)

export default FirmwareRoute
