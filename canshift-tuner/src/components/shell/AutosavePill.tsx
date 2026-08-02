import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { MONO_FONT } from '../../lib/typography'

export interface AutosavePillProps {
  lastSavedAt: number | null
}

const TICK_MS = 1000

const agoText = (deltaMs: number): string => {
  const sec = Math.max(0, Math.floor(deltaMs / 1000))
  if (sec < 5) return 'saved just now'
  if (sec < 60) return `saved ${String(sec)} s ago`
  const min = Math.floor(sec / 60)
  return `saved ${String(min)} min ago`
}

export const AutosavePill = ({ lastSavedAt }: AutosavePillProps) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (lastSavedAt === null) return
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [lastSavedAt])

  if (lastSavedAt === null) return null

  return <span style={pillStyle}>{agoText(now - lastSavedAt)}</span>
}

const pillStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  border: '1px solid hsl(var(--brand-neutral-300))',
  padding: '2px 7px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}
