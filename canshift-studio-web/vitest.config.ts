// vitest.config.ts — Test runner config for the dash-hosted Studio renderer.
//
// Mirrors the Electron Studio's vitest setup: node environment for transport /
// store unit tests (no DOM needed yet), include only colocated *.test.ts files
// under src/. Globals enabled so individual specs don't need to import every
// helper.

import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@components': resolve(__dirname, 'src/components'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@services': resolve(__dirname, 'src/transport'),
      '@hooks': resolve(__dirname, 'src/hooks'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  },
})
