import * as Sentry from '@sentry/react'
import { isObservabilityEnabled, useObservabilityStore } from '../stores/observability.store'
import { useDeviceStore } from '../stores/device.store'

const HEX_PAYLOAD = /\b(?:[0-9A-Fa-f]{2}[\s:]){3,}[0-9A-Fa-f]{2}\b/g
const PAYLOAD_PLACEHOLDER = '[payload]'

let initialized = false

export const scrubText = (text: string): string => text.replace(HEX_PAYLOAD, PAYLOAD_PLACEHOLDER)

export const scrubEvent = (event: Sentry.ErrorEvent): Sentry.ErrorEvent => {
  delete event.request
  delete event.user
  if (event.message) event.message = scrubText(event.message)
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value)
  }
  return event
}

export const scrubBreadcrumb = (breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb => {
  if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message)
  delete breadcrumb.data
  return breadcrumb
}

export const initSentry = (): void => {
  if (initialized || !isObservabilityEnabled()) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return

  Sentry.init({
    dsn,
    release: `canshift-tuner@${__TUNER_VERSION__}`,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
  initialized = true

  useDeviceStore.subscribe((state) => {
    Sentry.setTag('firmware.version', state.firmwareVersion ?? 'disconnected')
  })

  useObservabilityStore.subscribe((state) => {
    if (!state.enabled) void Sentry.close()
  })
}

export const isSentryReady = (): boolean => initialized

export const addErrorBreadcrumb = (level: 'warning' | 'error', message: string): void => {
  if (!initialized || !isObservabilityEnabled()) return
  Sentry.addBreadcrumb({ category: 'tuner.log', level, message: scrubText(message) })
}

export const captureBoundaryError = (error: Error, scope: string): void => {
  if (!initialized || !isObservabilityEnabled()) return
  Sentry.captureException(error, { tags: { boundary: scope } })
}
