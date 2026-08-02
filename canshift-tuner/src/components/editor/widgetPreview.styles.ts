import { sensorOkColor, sensorWarningColor, type SensorIconName } from '@tmbk/canshift-core'

export const FONT_FAMILY = "'JetBrains Mono', ui-monospace, monospace"

export const FONT_WEIGHT_VALUE = 900

export const BLINK_ANIM = 'canshift-blink 0.7s step-end infinite'

export const BLINK_KEYFRAMES_CSS =
  '@keyframes canshift-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }'

export const ZONE_NORMAL = '#00CC44'
export const ZONE_DANGER = '#FF4444'

export const paletteFillColor = (
  iconName: SensorIconName | undefined,
  valuePct: number,
  dangerPct: number
): string | undefined => {
  const ok = sensorOkColor(iconName)
  if (!ok) return undefined
  const warning = sensorWarningColor(iconName)
  if (warning === undefined) return ok
  return valuePct >= dangerPct ? warning : ok
}

export const thresholdPct = (level: number, min: number, max: number): number => {
  const range = max - min || 1
  return Math.max(0, Math.min(1, (level - min) / range))
}
