// base64.ts — Pure base64 <-> UTF-8 string helpers (extracted from ble.service.ts)

import { Buffer } from 'buffer'

export function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

export function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}
