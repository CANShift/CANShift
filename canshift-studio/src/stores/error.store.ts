// error.store.ts — Active application errors shown in ErrorBar.
//
// push: add a new error (prepended, newest first, max 20 kept)
// pushOrUpdate: upsert by source+code — avoids flooding for recurring errors (e.g. CAN health)
// dismiss: remove a single error by id
// clear: wipe all errors

import { create } from 'zustand'

export type ErrorSource = 'usb' | 'can' | 'config' | 'system'

export interface AppError {
  id: number
  source: ErrorSource
  code: string
  message: string
  detail?: string
  timestamp: Date
}

interface ErrorState {
  errors: AppError[]
  push: (error: Omit<AppError, 'id' | 'timestamp'>) => void
  pushOrUpdate: (error: Omit<AppError, 'id' | 'timestamp'>) => void
  dismiss: (id: number) => void
  clear: () => void
}

const MAX_ERRORS = 20
let nextId = 1

export const useErrorStore = create<ErrorState>()((set) => ({
  errors: [],

  push: (error) => {
    set((s) => {
      const entry: AppError = { ...error, id: nextId++, timestamp: new Date() }
      return { errors: [entry, ...s.errors].slice(0, MAX_ERRORS) }
    })
  },

  pushOrUpdate: (error) => {
    set((s) => {
      const existing = s.errors.find((e) => e.source === error.source && e.code === error.code)
      if (existing) {
        const updated: AppError = {
          ...existing,
          message: error.message,
          timestamp: new Date(),
          ...(error.detail !== undefined ? { detail: error.detail } : {}),
        }
        return { errors: s.errors.map((e) => (e.id === existing.id ? updated : e)) }
      }
      const entry: AppError = { ...error, id: nextId++, timestamp: new Date() }
      return { errors: [entry, ...s.errors].slice(0, MAX_ERRORS) }
    })
  },

  dismiss: (id) => {
    set((s) => ({ errors: s.errors.filter((e) => e.id !== id) }))
  },

  clear: () => {
    set({ errors: [] })
  },
}))
