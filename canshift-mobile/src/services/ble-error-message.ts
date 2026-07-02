import type { BleConnectionError } from './ble.errors'

export interface BleErrorMessage {
  title: string
  body: string
}

export const bleErrorMessage = (err: BleConnectionError): BleErrorMessage => {
  switch (err.kind) {
    case 'bluetooth-off':
      return { title: 'Bluetooth is off', body: 'Turn Bluetooth on to connect to your dashboard.' }
    case 'not-paired':
      return {
        title: 'Device not found',
        body: 'The dashboard is not advertising. Power-cycle it and scan again.',
      }
    case 'not-in-range':
      return {
        title: 'Device out of range',
        body: 'Move closer to the dashboard and try again.',
      }
    case 'disconnected':
      return {
        title: 'Disconnected',
        body: 'The dashboard disconnected. Try connecting again.',
      }
    case 'characteristic-missing':
      return {
        title: 'Incompatible firmware',
        body: 'This dashboard is missing required BLE services. Update the firmware.',
      }
    case 'write-failed':
      return {
        title: 'Connection failed',
        body: err.reason ?? 'A BLE write failed. Try again in a moment.',
      }
    case 'permission-denied':
      return {
        title: 'Bluetooth permission needed',
        body:
          err.platform === 'android'
            ? 'CANShift needs nearby devices permission. Open app settings to grant it.'
            : 'CANShift needs Bluetooth access to find your dashboard.',
      }
    case 'unknown':
      return { title: 'Connection failed', body: err.message }
    default: {
      const _exhaustive: never = err
      void _exhaustive
      return { title: 'Connection failed', body: 'Unknown error' }
    }
  }
}
