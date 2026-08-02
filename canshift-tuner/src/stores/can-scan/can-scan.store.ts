import { create } from 'zustand'
import { canScannerIpc, deviceEvents } from '../../transport'
import { useDeviceStore } from '../device.store'
import { useLogStore } from '../log.store'
import { createScanAccumulator, emptySnapshot } from './accumulator'
import { captureFlowEvent } from '../../lib/posthog'
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
  startLearn: () => void
  stopLearn: () => void
  clearLearn: () => void
}

const accumulator = createScanAccumulator()
let unsubscribeFrames: (() => void) | null = null
let snapshotTimer: number | null = null
let generation = 0

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
      if (status === 'running' || status === 'starting' || status === 'stopping') return

      const gen = ++generation
      set({ status: 'starting', error: null })
      accumulator.reset()
      set({ snapshot: emptySnapshot() })

      const result = await canScannerIpc.start()
      if (generation !== gen) {
        if (result.success) void canScannerIpc.stop()
        return
      }
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

      generation += 1
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
      if (get().status === 'running') accumulator.markStarted(performance.now())
      set({ snapshot: emptySnapshot() })
    },

    startLearn: () => {
      if (get().status !== 'running') return
      accumulator.startLearn()
      set({ snapshot: accumulator.snapshot(performance.now()) })
      captureFlowEvent('can_learn_started')
    },

    stopLearn: () => {
      accumulator.stopLearn()
      set({ snapshot: accumulator.snapshot(performance.now()) })
    },

    clearLearn: () => {
      accumulator.clearLearn()
      set({ snapshot: accumulator.snapshot(performance.now()) })
    },
  }
})

useDeviceStore.subscribe((deviceState) => {
  if (deviceState.connected && !deviceState.simulationMode) return
  const { status, stop } = useCanScanStore.getState()
  if (status === 'running' || status === 'starting') void stop()
})
