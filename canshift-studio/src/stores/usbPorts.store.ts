// usbPorts.store.ts — Available USB serial ports (issue #1015, S-H-3).
//
// Pre-refactor, `useUsbConnection` held the discovered port list + selection
// + loading flag in local `useState` and the `ConnectModal` USB tab fired an
// IPC `usbService.listPorts()` from inside a `useEffect` on mount. That
// matches the "useEffect for data fetching" anti-pattern.
//
// Discovered ports are renderer-wide cross-cutting state — `useAutoConnect`
// could share the cache in a future PR. The connect / disconnect side of the
// flow stays in `useUsbConnection`: those are user-driven imperative calls,
// not data-fetching, and they don't belong in this store.

import { create } from 'zustand'
import type { PortInfo } from '../../shared/ipc-contract'
import { usbService } from '../services/ipc.service'
import { useDeviceStore } from './device.store'
import { useLogStore } from './log.store'
import { useErrorStore } from './error.store'

interface UsbPortsState {
  ports: PortInfo[]
  selectedPort: string
  loading: boolean
  /** Manually override the selection (e.g. user picked a port in the modal). */
  setSelectedPort: (port: string) => void
  /**
   * IPC-list ports and update state. Surfaces an error via the existing log /
   * error / device stores rather than throwing. Idempotent while a refresh is
   * in flight.
   */
  refresh: () => Promise<void>
}

export const useUsbPortsStore = create<UsbPortsState>()((set, get) => ({
  ports: [],
  selectedPort: '',
  loading: false,

  setSelectedPort: (port) => {
    set({ selectedPort: port })
  },

  refresh: async () => {
    if (get().loading) return
    set({ loading: true })
    const device = useDeviceStore.getState()
    const log = useLogStore.getState().push
    const pushError = useErrorStore.getState().push

    device.clearError()
    try {
      const list = await usbService.listPorts()
      set({
        ports: list,
        // Auto-select the only port when exactly one is present — preserves
        // the pre-refactor convenience behaviour. Otherwise clear so the user
        // has to make an explicit pick.
        selectedPort: list.length === 1 && list[0] ? list[0].path : '',
        loading: false,
      })
      log('info', `Found ${String(list.length)} port${list.length !== 1 ? 's' : ''}`)
    } catch {
      const msg = 'Failed to list serial ports'
      device.setError(msg)
      log('error', msg)
      pushError({ source: 'usb', code: 'PORT_LIST_FAILED', message: msg })
      set({ loading: false })
    }
  },
}))
