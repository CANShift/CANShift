// useDirtySync.ts — Push the dashboard isDirty flag to the main process so the
// window-close handler can prompt before discarding unsaved edits.

import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { IpcChannels } from '../../main/ipc/ipc-channels'

export function useDirtySync(): void {
  useEffect(() => {
    const sendIfChanged = (() => {
      let last: boolean | null = null
      return (dirty: boolean): void => {
        if (dirty === last) return
        last = dirty
        window.ipc.send(IpcChannels.WINDOW_SET_DIRTY, dirty)
      }
    })()

    sendIfChanged(useDashboardStore.getState().isDirty)
    return useDashboardStore.subscribe((s) => {
      sendIfChanged(s.isDirty)
    })
  }, [])
}
