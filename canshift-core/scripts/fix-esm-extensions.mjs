// fix-esm-extensions.mjs — Add `.js` to relative imports in dist/.
//
// canshift-core's tsconfig uses `moduleResolution: "Bundler"` so TS allows
// extensionless imports in source — but the emit preserves them as-is, and
// Node ESM (the studio Electron main process's runtime) refuses to resolve
// extensionless relative specifiers. This script walks dist/ and rewrites
// every `from './foo'` / `from '../foo'` to `from './foo.js'` so the
// package is loadable by Node directly without changing the source layout.
//
// Idempotent: imports already ending in `.js`, `.json`, `.mjs`, `.cjs` or
// pointing at a directory's index are left alone.

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const IMPORT_RE =
  /(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+?)\2/g

const SKIP_SUFFIX = ['.js', '.mjs', '.cjs', '.json']

function shouldSkip(spec) {
  return SKIP_SUFFIX.some((ext) => spec.endsWith(ext))
}

function rewriteSource(source, fileAbsPath) {
  return source.replace(IMPORT_RE, (whole, kw, quote, spec) => {
    if (shouldSkip(spec)) return whole
    // Resolve the import relative to the file to detect directory-style
    // imports (rare in this codebase but worth handling defensively).
    const target = resolve(dirname(fileAbsPath), spec)
    let resolved = `${spec}.js`
    try {
      const stat = statSync(target)
      if (stat.isDirectory()) resolved = `${spec}/index.js`
    } catch {
      // Path doesn't exist as a directory — assume it's a file missing `.js`.
    }
    return `${kw}${quote}${resolved}${quote}`
  })
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts'))) {
      const before = readFileSync(fullPath, 'utf8')
      const after = rewriteSource(before, fullPath)
      if (before !== after) writeFileSync(fullPath, after, 'utf8')
    }
  }
}

walk(DIST)
