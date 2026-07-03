import { useCallback, useEffect, useState } from 'react'

const REV_LIMIT_FLASH_HZ = 3
const REV_LIMIT_FLASH_HALF_PERIOD_MS = Math.round(1000 / (REV_LIMIT_FLASH_HZ * 2))
const REV_LIMIT_PREVIEW_MS = 5000

export interface UseRevLimiterFlashResult {
  revLimiting: boolean
  flashPhase: boolean
  startRevLimiter: () => void
}

export const useRevLimiterFlash = (): UseRevLimiterFlashResult => {
  const [revLimiting, setRevLimiting] = useState(false)
  const [flashPhase, setFlashPhase] = useState(false)

  useEffect(() => {
    if (!revLimiting) {
      setFlashPhase(false)
      return
    }
    const interval = setInterval(() => {
      setFlashPhase((v) => !v)
    }, REV_LIMIT_FLASH_HALF_PERIOD_MS)
    const timeout = setTimeout(() => {
      setRevLimiting(false)
    }, REV_LIMIT_PREVIEW_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [revLimiting])

  const startRevLimiter = useCallback(() => {
    setRevLimiting(true)
  }, [])

  return { revLimiting, flashPhase, startRevLimiter }
}
