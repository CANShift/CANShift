import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'

export const useUnsavedChangesGuard = (): void => {
  const isDirty = useDashboardStore((s) => s.isDirty)

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])
}
