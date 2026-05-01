// useSessionRestore.ts — Restore the last opened config file on app start.
//
// Runs once on mount. Reads the last file path from the main-process session
// store and, if found, opens the file directly (no dialog). Silently ignores
// failures — session restore is best-effort.

import { useEffect } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { migrateConfig, CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useLogStore } from '../stores/log.store'
import { sessionIpc, configService } from '../services/ipc.service'

export function useSessionRestore(): void {
  const setConfig = useDashboardStore((s) => s.setConfig)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    void (async () => {
      const lastPath = await sessionIpc.getLastFilePath()
      if (!lastPath) return

      const result = await configService.openPath(lastPath)
      if (result.success && result.content) {
        let config = result.content as DashboardConfig
        try {
          const { config: migrated, applied } = migrateConfig(
            config as unknown as Record<string, unknown>,
            CURRENT_SCHEMA_VERSION
          )
          config = migrated as unknown as DashboardConfig
          if (applied.length > 0) {
            log('info', `Config migrated on restore: ${applied.join(', ')}`)
          }
        } catch {
          // Silent — use config as-is if migration fails on session restore
        }
        setConfig(config, result.filePath)
        log('info', `Restored session: ${result.filePath ?? lastPath}`)
      }
      // Silent failure — file may have been moved or deleted since last session
    })()
  }, [setConfig, log])
}
