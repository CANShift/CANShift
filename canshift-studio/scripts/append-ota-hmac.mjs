#!/usr/bin/env node
// scripts/append-ota-hmac.mjs — Append the OTA HMAC-SHA256 trailer to a firmware binary.
//
// Wire contract: <firmware bytes> || HMAC_SHA256(firmware bytes, secret)
// Counterpart of the firmware verifier (#205, ota_hmac.cpp/.h). Required before
// flipping APP_OTA_REQUIRE_HMAC=1 on the device.
//
// Usage:
//   node scripts/append-ota-hmac.mjs <input.bin> <output.bin>
//
// Secret resolution (in order):
//   1. OTA_HMAC_SECRET env var (CI / production)
//   2. canshift-studio/secrets.json with key `otaHmacSecret`
//   3. Dev fallback `DEV_INSECURE_REPLACE_BEFORE_PROD` — must match the
//      firmware fallback in canshift-firmware/include/app_config.h byte-for-byte.
//
// The secret is never logged. The script prints only the trailer hash (safe —
// HMAC is not the secret) and a one-line size summary.

import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STUDIO_ROOT = resolve(__dirname, '..')
const TRAILER_BYTES = 32
const DEV_FALLBACK = 'DEV_INSECURE_REPLACE_BEFORE_PROD'

function usage() {
  console.error('Usage: node scripts/append-ota-hmac.mjs <input.bin> <output.bin>')
  process.exit(2)
}

function loadSecret() {
  const fromEnv = process.env.OTA_HMAC_SECRET
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return { secret: fromEnv, source: 'env' }
  }
  const secretsPath = resolve(STUDIO_ROOT, 'secrets.json')
  if (existsSync(secretsPath)) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(secretsPath, 'utf8'))
    } catch {
      throw new Error('Invalid JSON in canshift-studio/secrets.json')
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.otaHmacSecret === 'string') {
      const candidate = parsed.otaHmacSecret
      if (candidate.length > 0) {
        return { secret: candidate, source: 'secrets.json' }
      }
    }
  }
  return { secret: DEV_FALLBACK, source: 'dev-fallback' }
}

function main() {
  const [inputPath, outputPath] = process.argv.slice(2)
  if (!inputPath || !outputPath) usage()

  const firmware = readFileSync(inputPath)
  const { secret, source } = loadSecret()
  if (source === 'dev-fallback') {
    console.warn(
      '[ota-hmac] WARNING: using DEV_INSECURE_REPLACE_BEFORE_PROD — not safe for production.'
    )
  }

  const trailer = createHmac('sha256', secret).update(firmware).digest()
  if (trailer.length !== TRAILER_BYTES) {
    throw new Error(`HMAC length mismatch: got ${trailer.length}, expected ${TRAILER_BYTES}`)
  }

  const out = Buffer.concat([firmware, trailer], firmware.length + TRAILER_BYTES)
  writeFileSync(outputPath, out)

  console.log(
    `[ota-hmac] ${inputPath} (${firmware.length} bytes) + 32-byte trailer → ${outputPath} (${out.length} bytes) [secret-source=${source}]`
  )
  console.log(`[ota-hmac] trailer-sha256-hex=${trailer.toString('hex')}`)
}

try {
  main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ota-hmac] error: ${message}`)
  process.exit(1)
}
