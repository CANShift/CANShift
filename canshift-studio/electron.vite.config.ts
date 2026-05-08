// electron.vite.config.ts — Build config for Electron main + preload + renderer

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import type { PluginOption } from 'vite'
import { resolve } from 'path'

const analyze = process.env.ANALYZE === '1'

const rendererPlugins: PluginOption[] = [react()]
if (analyze) {
  rendererPlugins.push(
    visualizer({
      filename: resolve(__dirname, 'dist/renderer-stats.html'),
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      // Open the report only when running interactively (skip on CI/scripted runs).
      open: process.env.CI !== 'true',
    }) as PluginOption
  )
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      lib: {
        entry: resolve(__dirname, 'main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: resolve(__dirname, 'main/preload.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, '.'),
    plugins: rendererPlugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@lib': resolve(__dirname, 'src/lib'),
        '@components': resolve(__dirname, 'src/components'),
        '@stores': resolve(__dirname, 'src/stores'),
        '@services': resolve(__dirname, 'src/services'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
  },
})
