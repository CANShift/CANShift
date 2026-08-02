import { create } from 'zustand'
import { canScannerIpc, deviceEvents } from '../../transport'
import { useDeviceStore } from '../device.store'
import { useLogStore } from '../log.store'
import { createScanAccumulator, emptySnapshot } from './accumulator'
import type { CanScanSnapshot } from './accumulator'

const SNAPSHOT_INTERVAL_MS = 250

export type CanScanStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

interface CanScanState {
  status: CanScanStatus
  error: string | null
  snapshot: CanScanSnapshot
  start: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
}

const accumulator = createScanAccumulator()
let unsubscribeFrames: (() => void) | null = null
let snapshotTimer: number | null = null

const log = (level: 'info' | 'warn' | 'error', message: string) => {
  useLogStore.getState().push(level, message)
}

export const useCanScanStore = create<CanScanState>()((set, get) => {
  const stopSnapshotTimer = () => {
    if (snapshotTimer !== null) {
      window.clearInterval(snapshotTimer)
      snapshotTimer = null
    }
  }

  const startSnapshotTimer = () => {
    stopSnapshotTimer()
    snapshotTimer = window.setInterval(() => {
      set({ snapshot: accumulator.snapshot(performance.now()) })
    }, SNAPSHOT_INTERVAL_MS)
  }

  return {
    status: 'idle',
    error: null,
    snapshot: emptySnapshot(),

    start: async () => {
      const { connected, simulationMode } = useDeviceStore.getState()
      if (!connected || simulationMode) return
      const { status } = get()
      if (status === 'running' || status === 'starting') return

      set({ status: 'starting', error: null })
      accumulator.reset()
      set({ snapshot: emptySnapshot() })

      const result = await canScannerIpc.start()
      if (!result.success) {
        const err = result.error ?? 'unknown_error'
        set({ status: 'error', error: err })
        log('error', `CAN scan start failed: ${err}`)
        return
      }

      accumulator.markStarted(performance.now())
      unsubscribeFrames = deviceEvents.onCanFrame((frame) => {
        accumulator.ingest(frame, performance.now())
      })
      startSnapshotTimer()
      set({ status: 'running' })
      log('info', 'CAN scan started')
    },

    stop: async () => {
      const { status } = get()
      if (status === 'idle' || status === 'stopping') return

      set({ status: 'stopping' })
      stopSnapshotTimer()
      if (unsubscribeFrames) {
        unsubscribeFrames()
        unsubscribeFrames = null
      }
      const result = await canScannerIpc.stop()
      if (!result.success) {
        log('warn', `CAN scan stop failed: ${result.error ?? 'unknown_error'}`)
      }
      set({ status: 'idle', snapshot: accumulator.snapshot(performance.now()) })
      log('info', `CAN scan stopped — ${String(accumulator.totalFrames())} frames captured`)
    },

    reset: () => {
      accumulator.reset()
      set({ snapshot: emptySnapshot() })
    },
  }
})

useDeviceStore.subscribe((deviceState) => {
  if (deviceState.connected && !deviceState.simulationMode) return
  const { status, stop } = useCanScanStore.getState()
  if (status === 'running' || status === 'starting') void stop()
})
