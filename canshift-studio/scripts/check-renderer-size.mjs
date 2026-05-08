#!/usr/bin/env node
// scripts/check-renderer-size.mjs — Fail the build when the renderer main chunk exceeds the budget.

import { readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(__dirname, '..', 'dist', 'renderer', 'assets')

// Budget for the renderer main chunk (`index-*.js`).
// Baseline at the time of writing: ~1013 KB minified (post #166 lazy-loading + shadcn).
// 1100 KB gives ~8% headroom — tight enough to catch regressions, loose enough to absorb minor adds.
// Issue #193: revisit and tighten as routes get further code-split.
const MAIN_CHUNK_BUDGET_BYTES = 1100 * 1024

const KIB = 1024

const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')

function findMainChunk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    throw new Error(`Renderer assets directory not found at ${dir}: ${error}`)
  }
  const matches = entries.filter((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name))
  if (matches.length === 0) {
    throw new Error(
      `No main renderer chunk (index-*.js) found in ${dir}. Did you run \`npm run build\`?`
    )
  }
  if (matches.length > 1) {
    throw new Error(`Multiple main renderer chunks found in ${dir}: ${matches.join(', ')}`)
  }
  return matches[0]
}

function formatKb(bytes) {
  return `${(bytes / KIB).toFixed(1)} KB`
}

function main() {
  const chunkName = findMainChunk(ASSETS_DIR)
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
