import { useEffect, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'

const TICK_INTERVAL_MS = 100

export const useGraphTick = (paused: boolean): number => {
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
