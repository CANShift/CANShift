// use-graph-tick.ts — 10 Hz refresh source for GraphScreen.
//
// Encapsulates the setInterval-driven tick that previously lived inside
// GraphScreen as a useEffect. The mobile coding standard (CLAUDE.md → React
// Native → "No useEffect for data fetching — use Zustand actions or custom
// hooks") flagged the inline pattern; extracting it keeps the timer logic
// + cleanup off the screen component while preserving identical semantics
// (tick increments every 100 ms while `paused === false`). Issue #794.

import { useEffect, useState } from 'react'

const TICK_INTERVAL_MS = 100

/**
 * Returns a monotonically increasing counter that bumps every 100 ms while
 * `paused === false`. Consumers depend on the returned value to trigger
 * useMemo re-evaluation on each tick. When `paused` flips to true the
 * counter freezes — switching back to false resumes from the current value.
 */
export function useGraphTick(paused: boolean): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setTick((n) => n + 1)
    }, TICK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [paused])

  return tick
}
