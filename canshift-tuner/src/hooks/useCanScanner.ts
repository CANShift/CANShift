import { useCanScanStore } from '../stores/can-scan/can-scan.store'
import type { CanScanStatus } from '../stores/can-scan/can-scan.store'
import type { CanFrameStats, CanScanSnapshot } from '../stores/can-scan/accumulator'

export type { CanFrameStats }
export type CanScannerSnapshot = CanScanSnapshot
export type CanScannerStatus = CanScanStatus

export interface UseCanScanner {
  status: CanScannerStatus
  error: string | null
  snapshot: CanScannerSnapshot
  start: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
}

export const useCanScanner = (): UseCanScanner => {
  const status = useCanScanStore((s) => s.status)
  const error = useCanScanStore((s) => s.error)
  const snapshot = useCanScanStore((s) => s.snapshot)
  const start = useCanScanStore((s) => s.start)
  const stop = useCanScanStore((s) => s.stop)
  const reset = useCanScanStore((s) => s.reset)

  return { status, error, snapshot, start, stop, reset }
}
