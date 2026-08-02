import { useEffect } from 'react'
import { useBurnDashboard } from './useBurnDashboard'
import { useLogStore } from '../stores/log.store'
import { useUiStore } from '../stores/ui.store'

export const useBurnShortcut = (): void => {
  const { canBurn, isBurning, requestBurn } = useBurnDashboard()
  const log = useLogStore((s) => s.push)
  const signalBurnDenied = useUiStore((s) => s.signalBurnDenied)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key !== 's') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (!canBurn) {
        if (!isBurning) {
          signalBurnDenied()
          log('info', 'Burn shortcut ignored — connect a device and edit the dashboard first')
        }
        return
      }
      requestBurn()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [canBurn, isBurning, requestBurn, log, signalBurnDenied])
}
