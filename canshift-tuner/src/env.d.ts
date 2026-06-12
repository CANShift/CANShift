/// <reference types="vite/client" />

declare const __TUNER_VERSION__: string
declare const __EXPECTED_FIRMWARE_MAJOR__: number

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
