import { useEffect } from 'react'
import { useConnectionStore } from '../stores/connection.store'

export const useAutoReconnect = (): void => {
  useEffect(() => {
    void useConnectionStore.getState().tryAutoReconnect()
  }, [])
}
