import posthog from 'posthog-js'
import { isObservabilityEnabled, useObservabilityStore } from '../stores/observability.store'

let initialized = false

const syncConsent = (enabled: boolean): void => {
  if (enabled) {
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()
  } else if (!posthog.has_opted_out_capturing()) {
    posthog.opt_out_capturing()
  }
}

export const initPostHog = (): void => {
  if (initialized) return
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com'
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  })
  syncConsent(isObservabilityEnabled())
  useObservabilityStore.subscribe((state) => {
    syncConsent(state.enabled)
  })
  initialized = true
}

export const captureFlowEvent = (name: string, props: Record<string, unknown> = {}): void => {
  if (!initialized || !isObservabilityEnabled()) return
  posthog.capture(name, { ...props, app: 'canshift-tuner', tunerVersion: __TUNER_VERSION__ })
}

export const isPostHogReady = (): boolean => initialized

export const captureFeedback = (props: {
  message: string
  email?: string
  route: string
  tunerVersion: string
}): void => {
  if (!initialized) return
  posthog.capture('feedback_submitted', props)
}
