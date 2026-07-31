import type { TimerCommand } from '@tmbk/canshift-core'
import { bleService } from './ble.service'
import { log } from '../stores/log.store'
import { useDeviceStore } from '../stores/device.store'
import { useTimerStore } from '../stores/timer.store'
import { recordSessionLap } from '../stores/timer-sessions.store'

const isDeviceDriven = (): boolean => {
  const { connectionState, mode } = useDeviceStore.getState()
  return connectionState === 'connected' && mode === 'ble'
}

const sendToDevice = (command: TimerCommand): void => {
  void bleService.sendTimerCommand(command).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    log('warn', `Timer '${command}' failed over BLE: ${msg}`)
  })
}

export const timerControl = {
  start: (): void => {
    if (isDeviceDriven()) sendToDevice('start')
    else useTimerStore.getState().start()
  },

  pause: (): void => {
    if (isDeviceDriven()) sendToDevice('pause')
    else useTimerStore.getState().pause()
  },

  resume: (): void => {
    if (isDeviceDriven()) sendToDevice('resume')
    else useTimerStore.getState().resume()
  },

  reset: (): void => {
    if (isDeviceDriven()) sendToDevice('reset')
    else useTimerStore.getState().reset()
  },

  lap: (): void => {
    if (isDeviceDriven()) {
      sendToDevice('lap')
      return
    }
    const lap = useTimerStore.getState().captureLocalLap()
    if (lap !== null) recordSessionLap(lap)
  },
}
