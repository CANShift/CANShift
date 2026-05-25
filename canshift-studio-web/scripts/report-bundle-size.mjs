#!/usr/bin/env node
// scripts/report-bundle-size.mjs — Walk dist/assets/*.js, compute gzip sizes,
// print a sorted table. Used to compare against the 500 KB initial-chunk
// ceiling defined by phase-1 (#1104).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_ASSETS = resolve(process.cwd(), 'dist/assets')

function format(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const files = readdirSync(DIST_ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => {
    const full = resolve(DIST_ASSETS, f)
    const raw = readFileSync(full)
    const gz = gzipSync(raw)
    return { name: f, raw: raw.length, gz: gz.length }
  })
  .sort((a, b) => b.gz - a.gz)

console.log('\nChunk sizes (sorted by gzipped):')
console.log('-'.repeat(78))
console.log('name'.padEnd(46), 'raw'.padStart(14), 'gzip'.padStart(14))
console.log('-'.repeat(78))
for (const f of files) {
  console.log(f.name.padEnd(46), format(f.raw).padStart(14), format(f.gz).padStart(14))
}
console.log('-'.repeat(78))
const total = files.reduce((acc, f) => ({ raw: acc.raw + f.raw, gz: acc.gz + f.gz }), { raw: 0, gz: 0 })
console.log('TOTAL'.padEnd(46), format(total.raw).padStart(14), format(total.gz).padStart(14))

// CSS too — small but worth reporting since it's in initial paint.
const cssFiles = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.css'))
if (cssFiles.length > 0) {
  console.log('\nCSS:')
  for (const f of cssFiles) {
    const full = resolve(DIST_ASSETS, f)
    const raw = readFileSync(full)
    const gz = gzipSync(raw)
    console.log(f.padEnd(46), format(raw.length).padStart(14), format(gz.length).padStart(14))
  }
}
