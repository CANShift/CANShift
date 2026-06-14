import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

const firmwarePkg = JSON.parse(
  readFileSync(resolve(__dirname, '../canshift-firmware/package.json'), 'utf8'),
) as { version: string }
const firmwareMajor = Number(firmwarePkg.version.split('.')[0] ?? 0)

const CORE_SRC_INDEX = resolve(__dirname, '../canshift-core/src/index.ts')

const FIRMWARE_OWNER = 'tburkhalterr'
const FIRMWARE_REPO = 'CANShift'
const FIRMWARE_TAG_RE = /^v?\d+\.\d+\.\d+([.-][a-z0-9.-]+)?$/i
const FIRMWARE_ASSET_RE = /^[a-z0-9._-]+\.bin$/i

const firmwareDownloadDevProxy = (): Plugin => ({
  name: 'firmware-download-dev-proxy',
  configureServer(server) {
    server.middlewares.use('/api/firmware-download', (req, res) => {
      const url = new URL(req.url ?? '', 'http://localhost')
      const tag = url.searchParams.get('tag')
      const asset = url.searchParams.get('asset')
      if (!tag || !FIRMWARE_TAG_RE.test(tag)) {
        res.statusCode = 400
        res.end('bad_tag')
        return
      }
      if (!asset || !FIRMWARE_ASSET_RE.test(asset)) {
        res.statusCode = 400
        res.end('bad_asset')
        return
      }
      const target = `https://github.com/${FIRMWARE_OWNER}/${FIRMWARE_REPO}/releases/download/${tag}/${asset}`
      fetch(target, { redirect: 'follow' })
        .then((upstream) => {
          if (!upstream.ok || !upstream.body) {
            res.statusCode = upstream.status
            res.end(`upstream_failed_${upstream.status.toString()}`)
            return
          }
          res.setHeader('Content-Type', 'application/octet-stream')
          const length = upstream.headers.get('content-length')
          if (length) res.setHeader('Content-Length', length)
          Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>).pipe(res)
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'unknown'
          res.statusCode = 502
          res.end(`upstream_failed: ${message}`)
        })
    })
  },
})

export default defineConfig(({ command }) => ({
  root: resolve(__dirname, '.'),
  define: {
    __TUNER_VERSION__: JSON.stringify(pkg.version),
    __EXPECTED_FIRMWARE_MAJOR__: JSON.stringify(firmwareMajor),
  },
  plugins: [react(), firmwareDownloadDevProxy()],
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
