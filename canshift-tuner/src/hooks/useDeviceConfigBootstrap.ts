import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { useLogStore } from '../stores/log.store'
import { deviceIpc } from '../transport'

export const useDeviceConfigBootstrap = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const loadFromDeviceOrDemo = useDashboardStore((s) => s.loadFromDeviceOrDemo)
  const markDirty = useDashboardStore((s) => s.markDirty)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || transport !== 'usb') return
    let cancelled = false
    void deviceIpc
      .getConfig()
      .then((result) => {
        if (cancelled) return
        if (result.kind === 'ok') {
          const outcome = loadFromDeviceOrDemo(result.config)
          if (outcome === 'device') {
            log('success', 'Loaded config from device')
            if (result.migrationsApplied.length > 0) {
              markDirty()
              log(
                'info',
                `Device config migrated (${result.migrationsApplied.join(', ')}) — burn to persist the upgrade`
              )
            }
          }
        } else if (result.kind === 'none') {
          const outcome = loadFromDeviceOrDemo(null)
          if (outcome === 'demo') log('info', 'Device has no config — loaded demo')
        } else {
          log('error', `Device config is unreadable or invalid: ${result.error}`)
          const outcome = loadFromDeviceOrDemo(null)
          if (outcome === 'demo') log('info', 'Loaded demo config instead')
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        log('error', `Failed to read device config: ${message}`)
      })
    return () => {
      cancelled = true
    }
  }, [connected, transport, loadFromDeviceOrDemo, markDirty, log])
}
