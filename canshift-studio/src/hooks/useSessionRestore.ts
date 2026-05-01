// useSessionRestore.ts — Restore the last opened config file on app start.
//
// Runs once on mount. Reads the last file path from the main-process session
// store and, if found, opens the file directly (no dialog). Silently ignores
// failures — session restore is best-effort.

import { useEffect } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
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
        setConfig(result.content as DashboardConfig, result.filePath)
        log('info', `Restored session: ${result.filePath ?? lastPath}`)
      }
      // Silent failure — file may have been moved or deleted since last session
    })()
  }, [setConfig, log])
}
