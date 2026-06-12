import posthog from 'posthog-js'

let initialized = false

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
  initialized = true
}

export const isPostHogReady = (): boolean => initialized
