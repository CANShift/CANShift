#!/usr/bin/env node
// scripts/gzip-dist.ts — Post-build: emit a .gz sibling for every text
// asset in dist/. The firmware embeds these .gz files via
// `board_build.embed_files` and serves them with `Content-Encoding: gzip`
// (issue #1077 phase 4), so the source-of-truth gzipped artifacts must
// live next to their plain counterparts after `npm run build`.
//
// Only text-ish artifacts (html, js, css, svg, json, map) are gzipped —
// woff2 / png / jpg are already compressed and would only grow.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = resolve(process.cwd(), 'dist')

const GZIP_EXT = new Set(['.html', '.js', '.css', '.svg', '.json', '.map', '.txt'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walk(full))
    } else {
      out.push(full)
    }
  }
  return out
}

function shouldGzip(path) {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return false
  return GZIP_EXT.has(path.slice(dot).toLowerCase())
}

function format(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

let totalRaw = 0
let totalGz = 0
const rows = []
for (const file of walk(DIST)) {
  if (!shouldGzip(file)) continue
  if (file.endsWith('.gz')) continue
  const raw = readFileSync(file)
  // Level 9 — slowest, smallest. Build is ~1 s; an extra ~50 ms here is
  // worth ~5% smaller payload that ships in every device's flash.
  const gz = gzipSync(raw, { level: 9 })
  writeFileSync(`${file}.gz`, gz)
  rows.push({ path: file.replace(`${DIST}/`, ''), raw: raw.length, gz: gz.length })
  totalRaw += raw.length
  totalGz += gz.length
}

console.log('\n[gzip-dist] gzipped artifacts:')
console.log('-'.repeat(78))
for (const r of rows.sort((a, b) => b.gz - a.gz)) {
  console.log(
    r.path.padEnd(46),
    format(r.raw).padStart(14),
    format(r.gz).padStart(14),
  )
}
console.log('-'.repeat(78))
console.log('TOTAL'.padEnd(46), format(totalRaw).padStart(14), format(totalGz).padStart(14))
