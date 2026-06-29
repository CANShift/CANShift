import { useEffect } from 'react'
import { useBurnDashboard } from './useBurnDashboard'

export const useBurnShortcut = (): void => {
  const { canBurn, burn } = useBurnDashboard()
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key !== 's') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (!canBurn) return
      void burn()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [canBurn, burn])
}
