// use-graph-tick.ts — 10 Hz refresh source for GraphScreen.
//
// Encapsulates the setInterval-driven tick that previously lived inside
// GraphScreen as a useEffect. The mobile coding standard (CLAUDE.md → React
// Native → "No useEffect for data fetching — use Zustand actions or custom
// hooks") flagged the inline pattern; extracting it keeps the timer logic
// + cleanup off the screen component while preserving identical semantics
// (tick increments every 100 ms while `paused === false`). Issue #794.

import { useEffect, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'

const TICK_INTERVAL_MS = 100

/**
 * Returns a monotonically increasing counter that bumps every 100 ms while
 * the consumer screen is **focused** AND `paused === false`. Consumers
 * depend on the returned value to trigger useMemo re-evaluation on each
 * tick.
 *
 * Two pause sources:
 *   1. Explicit `paused` flag — the toolbar pause button on GraphScreen.
 *      Switching back to false resumes from the current counter value.
 *   2. Screen focus — `@react-navigation/native::useIsFocused`. Navigating
 *      away from the graph (Dashboard, Settings, etc.) freezes the timer
 *      so the 10 Hz wakeup doesn't drain battery while the screen is
 *      off-screen (#1017 M-LO-6). Re-entering resumes.
 *
 * The two sources are OR-combined — either one going truthy freezes the
 * counter.
 */
export function useGraphTick(paused: boolean): number {
  const [tick, setTick] = useState(0)
  const isFocused = useIsFocused()

  useEffect(() => {
    if (paused || !isFocused) return
    const id = setInterval(() => {
      setTick((n) => n + 1)
    }, TICK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [paused, isFocused])

  return tick
}
