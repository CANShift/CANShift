import { useEffect, useState } from 'react'
import { useTrackSessionStore } from '../stores/track-session.store'

const TICK_INTERVAL_MS = 50

export const useCurrentLapMs = (): number => {
  const recording = useTrackSessionStore((s) => s.recording)
  const sessionStartMs = useTrackSessionStore((s) => s.sessionStartMs)
  const lastLapEndMs = useTrackSessionStore((s) => s.laps[s.laps.length - 1]?.endMs ?? null)
  const lapStartMs = lastLapEndMs ?? sessionStartMs
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!recording) {
      setElapsedMs(0)
      return
    }
    const sync = () => {
      setElapsedMs(Math.max(0, Date.now() - lapStartMs))
    }
    sync()
    const id = setInterval(sync, TICK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [recording, lapStartMs])

  return elapsedMs
}
