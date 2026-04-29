// useUpdater.ts — Subscribe to auto-update IPC events from the main process

import { useEffect, useState } from 'react'

export type UpdateStatus = 'idle' | 'available' | 'downloaded' | 'error'

export interface UpdateState {
  status: UpdateStatus
  version: string | null
  errorMessage: string | null
}

interface UpdatePayload {
  version: string
  releaseDate: string
  releaseNotes: string
}

interface ErrorPayload {
  message: string
}

export function useUpdater(): UpdateState & {
  installUpdate: () => void
  checkForUpdates: () => void
} {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    errorMessage: null,
  })

  useEffect(() => {
    const onAvailable = (payload: UpdatePayload) => {
      setState({ status: 'available', version: payload.version, errorMessage: null })
    }

    const onDownloaded = (payload: UpdatePayload) => {
      setState({ status: 'downloaded', version: payload.version, errorMessage: null })
    }

    const onError = (payload: ErrorPayload) => {
      setState((prev) => ({ ...prev, status: 'error', errorMessage: payload.message }))
    }

    window.ipc.on(window.ipc.channels.UPDATE_AVAILABLE, onAvailable as (...args: unknown[]) => void)
    window.ipc.on(
      window.ipc.channels.UPDATE_DOWNLOADED,
      onDownloaded as (...args: unknown[]) => void
    )
    window.ipc.on(window.ipc.channels.UPDATE_ERROR, onError as (...args: unknown[]) => void)

    return () => {
      window.ipc.off(
        window.ipc.channels.UPDATE_AVAILABLE,
        onAvailable as (...args: unknown[]) => void
      )
      window.ipc.off(
        window.ipc.channels.UPDATE_DOWNLOADED,
        onDownloaded as (...args: unknown[]) => void
      )
      window.ipc.off(window.ipc.channels.UPDATE_ERROR, onError as (...args: unknown[]) => void)
    }
  }, [])

  const installUpdate = () => {
    void window.ipc.invoke(window.ipc.channels.UPDATE_INSTALL)
  }

  const checkForUpdates = () => {
    void window.ipc.invoke(window.ipc.channels.UPDATE_CHECK)
  }

  return { ...state, installUpdate, checkForUpdates }
}
