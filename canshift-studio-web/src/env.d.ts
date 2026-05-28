/// <reference types="vite/client" />

// Injected by vite.config.ts `define` — Studio package.json `version` field.
declare const __STUDIO_VERSION__: string

declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
declare module '*.woff2' {
  const src: string
  export default src
}
