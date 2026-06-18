import { useEffect, useRef } from 'react'
import { detectOverflow } from '../lib/detect-overflow'
import { useDashboardStore } from '../stores/dashboard.store'
import { useLogStore } from '../stores/log.store'

export const useWidgetOverflowWarnings = (): void => {
  const config = useDashboardStore((s) => s.config)
  const targetProfile = useDashboardStore((s) => s.config?.targetProfile)
  const log = useLogStore((s) => s.push)
  const lastSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!config) {
      lastSignatureRef.current = null
      return
    }
    const overflowing = detectOverflow(config)
    const signature = `${targetProfile ?? 'default'}:${overflowing.map((o) => o.widgetId).sort().join(',')}`
    if (signature === lastSignatureRef.current) return
    lastSignatureRef.current = signature
    if (overflowing.length === 0) return

    const sample = overflowing
      .slice(0, 3)
      .map((o) => `${o.widgetId} (${String(o.layout.x)},${String(o.layout.y)} ${String(o.layout.w)}×${String(o.layout.h)})`)
      .join(', ')
    const more = overflowing.length > 3 ? ` + ${String(overflowing.length - 3)} more` : ''
    log(
      'warn',
      `${String(overflowing.length)} widget${overflowing.length === 1 ? '' : 's'} overflow the current target screen — ${sample}${more}`,
      'overflow'
    )
  }, [config, targetProfile, log])
}
