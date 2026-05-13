// realdash/parse-realdash-xml.ts — Pure regex RealDash CAN XML v2 parser.
//
// No runtime deps. Supports: V*N, V*N+C, V*N-C, V-C, V/N, V*N/M, V>>N
// conversions, both endianess/endianness spellings, name + targetId attrs.
// Complex multi-byte formulas (B0+..., V+ID...) are warned and skipped.

import type { SignalDef } from '../types/signal'

export interface ParseRealDashXMLResult {
  signals: SignalDef[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Attribute extraction
// ---------------------------------------------------------------------------

// Pre-process: escape any `>` inside quoted attribute values so the frame/value
// regex (which uses [^>]) doesn't choke on V>>N conversion strings.
function escapeAttribGT(xml: string): string {
  return xml.replace(/"[^"]*"/g, (match) => match.replace(/>/g, '\x00GT\x00'))
}

function unescapeGT(s: string): string {
  return s.replace(/\x00GT\x00/g, '>')
}

function getAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag)) !== null) {
    // m[1] and m[2] are always defined when the regex matches
    attrs[m[1]!] = unescapeGT(m[2]!)
  }
  return attrs
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSnakeCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function clampByteLength(n: number): 1 | 2 | 4 {
  if (n === 2) return 2
  if (n === 4) return 4
  return 1
}

// ---------------------------------------------------------------------------
// Conversion formula parser
// ---------------------------------------------------------------------------

interface Conversion {
  scale: number
  offset: number
  /** Bit index (0-based) for V>>N formulas; null otherwise. */
  bitShift: number | null
}

function parseConversion(expr: string | undefined): Conversion | 'complex' {
  if (!expr || expr.trim() === '') return { scale: 1, offset: 0, bitShift: null }
  const s = expr.trim()

  // V>>N — right-shift = extract single bit
  const shiftMatch = /^V\s*>>\s*(\d+)$/.exec(s)
  if (shiftMatch) return { scale: 1, offset: 0, bitShift: parseInt(shiftMatch[1]!, 10) }

  // V*N/M
  const mulDivMatch = /^V\s*\*\s*(-?\d+\.?\d*)\s*\/\s*(-?\d+\.?\d*)$/.exec(s)
  if (mulDivMatch) {
    const divisor = parseFloat(mulDivMatch[2]!)
    if (divisor === 0) return 'complex'
    return { scale: parseFloat(mulDivMatch[1]!) / divisor, offset: 0, bitShift: null }
  }

  // V/N
  const divMatch = /^V\s*\/\s*(-?\d+\.?\d*)$/.exec(s)
  if (divMatch) {
    const divisor = parseFloat(divMatch[1]!)
    if (divisor === 0) return 'complex'
    return { scale: 1 / divisor, offset: 0, bitShift: null }
  }

  // V*N  /  V*N+C  /  V*N-C  (spaces allowed around the operator)
  const mulMatch = /^V\s*\*\s*(-?\d+\.?\d*)\s*([+-]\s*\d+\.?\d*)?$/.exec(s)
  if (mulMatch) {
    const scale = parseFloat(mulMatch[1]!)
    const offset = mulMatch[2] ? parseFloat(mulMatch[2].replace(/\s+/g, '')) : 0
    return { scale, offset, bitShift: null }
  }

  // V+C  /  V-C
  const addMatch = /^V\s*([+-]\s*\d+\.?\d*)$/.exec(s)
  if (addMatch) {
    return { scale: 1, offset: parseFloat(addMatch[1]!.replace(/\s+/g, '')), bitShift: null }
  }

  return 'complex'
}

// ---------------------------------------------------------------------------
// Min/max derivation from raw bit range
// ---------------------------------------------------------------------------

function computeRange(
  byteLength: 1 | 2 | 4,
  signed: boolean,
  scale: number,
  offset: number
): { min: number; max: number } {
  const bits = byteLength * 8
  const rawMax = signed ? Math.pow(2, bits - 1) - 1 : Math.pow(2, bits) - 1
  const rawMin = signed ? -Math.pow(2, bits - 1) : 0
  const lo = Math.round((scale * rawMin + offset) * 100) / 100
  const hi = Math.round((scale * rawMax + offset) * 100) / 100
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseRealDashXML(xml: string): ParseRealDashXMLResult {
  const signals: SignalDef[] = []
  const warnings: string[] = []

  if (!xml.includes('<RealDashCAN')) {
    return { signals, warnings: ['Not a RealDash CAN XML file (missing <RealDashCAN> root)'] }
  }

  const safe = escapeAttribGT(xml)

  const frameRe = /<frame\b([^>]*)>([\s\S]*?)<\/frame>/g
  let frameMatch: RegExpExecArray | null

  while ((frameMatch = frameRe.exec(safe)) !== null) {
    const frameAttrs = getAttrs(frameMatch[1]!)
    const frameBody = frameMatch[2]!

    const rawId = frameAttrs['id'] ?? ''
    const canFrameId =
      rawId.toLowerCase().startsWith('0x') ? rawId.toLowerCase() : `0x${rawId.toLowerCase()}`

    // Both spellings appear in the wild; 'endianess' is the RealDash typo.
    const endian = (frameAttrs['endianess'] ?? frameAttrs['endianness'] ?? 'little').toLowerCase()
    const bigEndian = endian === 'big'

    const timeoutMs = parseInt(frameAttrs['timeout'] ?? '2000', 10) || 2000

    const valueRe = /<value\b([^>]*?)(?:\s*\/>|>\s*<\/value>)/g
    let valueMatch: RegExpExecArray | null
    let valueIndex = 0

    while ((valueMatch = valueRe.exec(frameBody)) !== null) {
      const va = getAttrs(valueMatch[1]!)

      // Name: prefer explicit name → channel_{targetId} → positional fallback
      let name: string
      if (va['name']) {
        name = toSnakeCase(va['name'])
      } else if (va['targetId']) {
        name = `channel_${va['targetId']}`
      } else {
        name = `signal_${rawId.replace(/^0x/i, '')}_${String(valueIndex)}`
      }

      const startByte = parseInt(va['offset'] ?? '0', 10)
      const byteLength = clampByteLength(parseInt(va['length'] ?? '1', 10))
      const signed = va['signed'] === 'true'
      const unit = va['units'] ?? ''

      const conv = parseConversion(va['conversion'])
      if (conv === 'complex') {
        warnings.push(
          `Skipped unsupported conversion "${va['conversion'] ?? ''}" on "${name}" (frame ${canFrameId})`
        )
        valueIndex++
        continue
      }

      const { scale, offset, bitShift } = conv

      let bitMask: string | undefined
      if (bitShift !== null) {
        bitMask = `0x${(1 << bitShift).toString(16).padStart(2, '0')}`
      } else if (unit === 'bit' && !va['conversion']) {
        // No conversion + unit="bit" → extract bit 0
        bitMask = '0x01'
      }

      const isBit = bitMask !== undefined
      const { min, max } = isBit
        ? { min: 0, max: 1 }
        : computeRange(byteLength, signed, scale, offset)

      const signal: SignalDef = {
        name,
        canFrameId,
        startByte,
        byteLength,
        bigEndian,
        signed,
        scale,
        offset,
        unit: isBit ? '' : unit,
        min,
        max,
        timeoutMs,
        ...(bitMask !== undefined ? { bitMask } : {}),
      }

      signals.push(signal)
      valueIndex++
    }
  }

  return { signals, warnings }
}
