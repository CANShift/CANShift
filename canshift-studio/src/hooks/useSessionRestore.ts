// useSessionRestore.ts — Restore the last opened config file on app start.
//
// Runs once on mount. Reads the last file path from the main-process session
// store and, if found, opens the file directly (no dialog). Silently ignores
// failures — session restore is best-effort.

import { useEffect } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { migrateConfig, validateDashboard, CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
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
        const rawContent = result.content as Record<string, unknown>
        let migrated: Record<string, unknown>
        try {
          const out = migrateConfig(rawContent, CURRENT_SCHEMA_VERSION)
          migrated = out.config
          if (out.applied.length > 0) {
            log('info', `Config migrated on restore: ${out.applied.join(', ')}`)
          }
        } catch (err) {
          // Skip restore when migration fails — better to start with a clean
          // editor than to silently load a config the user cannot trust. The
          // file is still on disk; the user can open it explicitly and see
          // the proper error path in useConfigActions (#157).
          const msg = err instanceof Error ? err.message : String(err)
          log('warn', `Session restore skipped — migration failed for ${lastPath}: ${msg}`)
          return
        }
        // Mirror the open / import guard: refuse to push a malformed shape
        // into the store, even if migration succeeded. A corrupt session
        // file or a migration whose output drifts from the current schema
        // would otherwise silently corrupt the editor (#889).
        const validation = validateDashboard(migrated)
        if (!validation.valid || !validation.config) {
          validation.errors.forEach((e) => {
            log('error', `Session restore validation: ${e}`)
          })
          log(
            'warn',
            `Session restore skipped — ${String(validation.errors.length)} validation error(s) for ${lastPath}`
          )
          return
        }
        validation.warnings.forEach((w) => {
          log('warn', `Session restore: ${w}`)
        })
        setConfig(validation.config, result.filePath)
        log('info', `Restored session: ${result.filePath ?? lastPath}`)
      }
      // Silent failure — file may have been moved or deleted since last session
    })()
  }, [setConfig, log])
}
