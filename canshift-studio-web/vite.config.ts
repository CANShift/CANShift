// vite.config.ts — Plain Vite build for the dash-hosted Studio renderer (#1104).
//
// Phase-1 spike: no Electron-vite, no main/preload. Output is a SPA that
// later (#1105 / phase 3) gets bundled into the firmware's WebServer payload.
// Manual chunking splits Radix + canshift-core out of the index chunk so
// the initial load stays under the 500 KB gzipped ceiling.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, '.'),
  plugins: [react()],
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
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Stable, hash-free filenames. The dash isn't a CDN — the SPA ships
        // inside the OTA firmware payload (#1077 phase 4), so cache-busting
        // via content hash buys nothing and breaks `board_build.embed_files`
        // (which needs deterministic paths). Hash-free names let the embed
        // list live in `platformio.ini` and the HTTP route table in
        // `wifi_ap.cpp` stay 1:1 with what Vite emits.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          // Fonts keep a stable name so the CSS @font-face URL matches the
          // embedded file path verbatim. Same applies to the index CSS.
          const name = assetInfo.name ?? 'asset'
          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name][extname]'
        },
        manualChunks(id) {
          // React + router stay in a single vendor chunk: they're needed at
          // first paint, so isolating them just trades inline cost for a
          // parallel fetch — kept here mainly so the chunk list is legible.
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
          }
          // Radix primitives — only used by dialogs/popovers; splitting buys
          // a noticeable cut on the index chunk because each primitive drags
          // its own focus-trap / dismissable-layer helpers.
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix'
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'vendor-state'
          }
          // canshift-core is small but every store imports schemas/tokens.
          // Pin to a chunk so it isn't duplicated across lazy entries.
          if (id.includes('@tmbk/canshift-core')) {
            return 'vendor-core'
          }
          return undefined
        },
      },
    },
  },
})
