#!/usr/bin/env node
// scripts/check-renderer-size.mjs — Fail the build when the renderer main chunk exceeds the budget.

import { readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER_DIR = resolve(__dirname, '..', 'dist', 'renderer')
const ASSETS_DIR = join(RENDERER_DIR, 'assets')
const INDEX_HTML = join(RENDERER_DIR, 'index.html')

// Budget for the renderer main chunk (`index-*.js`).
// After audit S-M-1 (umbrella #1015) — lazied `EditorRoute` — the chunk
// dropped from ~1236 KB to ~895 KB. New budget of 940 KB gives ~5 %
// headroom on top of the current size so the gate fails fast on the
// next PR that would re-grow the initial payload by 5 % or more.
// Prior budget: 1280 KB. Re-tighten if further route splits or vendor
// extraction drop the baseline another 50+ KB.
const MAIN_CHUNK_BUDGET_BYTES = 940 * 1024

const KIB = 1024

const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')

// Parse `index.html` for the actual `<script type="module" … src="…">` the
// browser bootstraps from. We can't just glob `index-*.js` any more: once
// `EditorRoute` was lazied (audit S-M-1), Rollup started emitting sibling
// `index-*.js` shared chunks for code split out of the editor tree, which
// have nothing to do with the initial payload the budget is meant to guard.
function findEntryChunk() {
  let html
  try {
    html = readFileSync(INDEX_HTML, 'utf8')
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    throw new Error(`Renderer index.html not found at ${INDEX_HTML}: ${error}`)
  }
  const match = html.match(
    /<script[^>]*type=["']module["'][^>]*src=["']([^"']+\/(index-[A-Za-z0-9_-]+\.js))["']/
  )
  if (!match) {
    throw new Error(
      `No module entry <script src="…/index-*.js"> found in ${INDEX_HTML}. ` +
        `Did you run \`npm run build\`?`
    )
  }
  return basename(match[2])
}

function formatKb(bytes) {
  return `${(bytes / KIB).toFixed(1)} KB`
}

function main() {
  const chunkName = findEntryChunk()
  const chunkPath = join(ASSETS_DIR, chunkName)
  const { size } = statSync(chunkPath)
  const overBudget = size > MAIN_CHUNK_BUDGET_BYTES

  if (verbose || overBudget) {
    console.log(`Renderer main chunk: ${chunkName}`)
    console.log(`  size:   ${formatKb(size)} (${size} bytes)`)
    console.log(`  budget: ${formatKb(MAIN_CHUNK_BUDGET_BYTES)} (${MAIN_CHUNK_BUDGET_BYTES} bytes)`)
  }

  if (overBudget) {
    const overBy = size - MAIN_CHUNK_BUDGET_BYTES
    console.error(
      `\n[size-budget] FAIL: renderer main chunk exceeds budget by ${formatKb(overBy)}. ` +
        `Run \`npm run analyze\` to inspect the treemap and trim or split heavy modules.`
    )
    process.exit(1)
  }

  if (verbose) {
    console.log('[size-budget] OK')
  }
}

try {
  main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[size-budget] error: ${message}`)
  process.exit(2)
}
