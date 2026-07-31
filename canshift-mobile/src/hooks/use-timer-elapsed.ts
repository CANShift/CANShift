import { useEffect, useState } from 'react'
import { elapsedMsOf, useTimerStore, type TimerStatus } from '../stores/timer.store'

const DISPLAY_TICK_MS = 50

export const useTimerElapsed = (status: TimerStatus): number => {
  const [elapsedMs, setElapsedMs] = useState(() => elapsedMsOf(useTimerStore.getState()))

  useEffect(() => {
    const sync = () => {
      setElapsedMs(elapsedMsOf(useTimerStore.getState()))
    }
    sync()
    if (status !== 'running') return
    const id = setInterval(sync, DISPLAY_TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [status])

  return elapsedMs
}
