// vite.config.ts — CANShift Tuner (Vercel-hosted SPA).
//
// Unlike canshift-studio-web, this bundle is NOT embedded in firmware SPIFFS.
// It is hosted on Vercel and talks to the firmware over WebSerial (CH340 UART).
// Standard hashed asset names — no SPIFFS path-length / embed_files contract
// to honour, no manual chunk pinning for the legacy `a/` output dir.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

const firmwarePkg = JSON.parse(
  readFileSync(resolve(__dirname, '../canshift-firmware/package.json'), 'utf8'),
) as { version: string }
const firmwareMajor = Number(firmwarePkg.version.split('.')[0] ?? 0)

const CORE_SRC_INDEX = resolve(__dirname, '../canshift-core/src/index.ts')

export default defineConfig(({ command }) => ({
  root: resolve(__dirname, '.'),
  define: {
    __TUNER_VERSION__: JSON.stringify(pkg.version),
    __EXPECTED_FIRMWARE_MAJOR__: JSON.stringify(firmwareMajor),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@components': resolve(__dirname, 'src/components'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@services': resolve(__dirname, 'src/transport'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      ...(command === 'serve' ? { '@tmbk/canshift-core': CORE_SRC_INDEX } : {}),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
          }
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix'
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'vendor-state'
          }
          if (id.includes('@tmbk/canshift-core')) {
            return 'vendor-core'
          }
          return undefined
        },
      },
    },
  },
}))
