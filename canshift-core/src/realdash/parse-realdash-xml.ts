// realdash/parse-realdash-xml.ts — Pure regex RealDash CAN XML v2 parser.
//
// No runtime deps. Handles:
//   - frames baseId (decimal / hex) added to every child frame id
//   - frame-level signed + endianness defaults; per-value overrides
//   - rangeMin/rangeMax when present (more accurate than computed range)
//   - XML entity decoding (&amp; &lt; &gt;) in attribute values
//   - V*N, V*N+C, V/N, V*N/M, V>>N conversions; warns on complex formulas
//
// Every emitted signal is validated through SignalDefSchema (issue #1016 /
// C-HI-1). Malformed rows (e.g. length="3", which the schema does not allow)
// are diverted to `warnings` instead of being silently coerced.

import { SignalDefSchema, type SignalDef } from '../schemas/signal.js'

export interface ParseRealDashXMLResult {
  signals: SignalDef[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Attribute extraction
// ---------------------------------------------------------------------------

// Replace literal `>` inside quoted attribute values with a Unicode PUA
// placeholder so the outer [^>] regex doesn't stop early on V>>N strings.
// U+E001 is in the Private Use Area; it cannot appear in valid XML content
// and is not a control character (no-control-regex does not flag it).
const GT_PUA = ''
const GT_PUA_RE = //g

function escapeAttribGT(xml: string): string {
  return xml.replace(/"[^"]*"/g, (match) => match.replace(/>/g, GT_PUA))
}

// Restore PUA placeholder and decode all standard XML entities.
function decodeAttrValue(s: string): string {
  return s
    .replace(GT_PUA_RE, '>')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function getAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag)) !== null) {
    const key = m[1]
    const val = m[2]
    if (key !== undefined && val !== undefined) {
      attrs[key] = decodeAttrValue(val)
    }
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

function parseHexOrDec(s: string): number {
  const t = s.trim()
  return t.toLowerCase().startsWith('0x') ? parseInt(t, 16) : parseInt(t, 10)
}

/** Returns true/false when the endianness attr is present, null when absent. */
function resolveEndian(raw: string | undefined): boolean | null {
  if (!raw) return null
  return raw.toLowerCase() === 'big'
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

const wrappedByOuterPair = (s: string): boolean => {
  let depth = 0
  for (let i = 0; i < s.length - 1; i++) {
    depth += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0
    if (depth === 0) return false
  }
  return true
}

const stripOuterParens = (s: string): string => {
  let current = s.trim()
  while (current.startsWith('(') && current.endsWith(')') && wrappedByOuterPair(current)) {
    current = current.slice(1, -1).trim()
  }
  return current
}

const unwrapVChain = (s: string): string =>
  s.replace(/\(V((?:\s*[*/]\s*-?(?:\d+\.\d+|\d+|\.\d+))+)\)/g, (_, chain: string) => `V${chain}`)

const foldChain = (chain: string): number | null => {
  const tokens = chain.match(/[*/]\s*-?\d+\.?\d*/g)
  if (!tokens) return null
  let scale = 1
  for (const tok of tokens) {
    const isDiv = tok.startsWith('/')
    const num = parseFloat(tok.slice(1))
    if (!Number.isFinite(num) || (isDiv && num === 0)) return null
    scale = isDiv ? scale / num : scale * num
  }
  return scale
}

const tryMatch = (
  s: string,
  re: RegExp,
  build: (m: RegExpExecArray) => Conversion | 'complex'
): Conversion | 'complex' | null => {
  const m = re.exec(s)
  return m ? build(m) : null
}

const NUM_RE = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
const parseConversion = (expr: string | undefined): Conversion | 'complex' => {
  if (!expr || expr.trim() === '') return { scale: 1, offset: 0, bitShift: null }
  const s = unwrapVChain(stripOuterParens(expr.trim()))

  if (/^V$/i.test(s)) return { scale: 1, offset: 0, bitShift: null }

  return (
    tryMatch(s, /^V\s*>>\s*(\d+)$/, (m) => ({
      scale: 1,
      offset: 0,
      bitShift: parseInt(m[1] ?? '0', 10),
    })) ??
    tryMatch(s, new RegExp(`^(${NUM_RE})\\s*-\\s*V$`), (m) => ({
      scale: -1,
      offset: parseFloat(m[1] ?? '0'),
      bitShift: null,
    })) ??
    tryMatch(s, new RegExp(`^V((?:\\s*[*/]\\s*${NUM_RE})+)$`), (m) => {
      const result = foldChain(m[1] ?? '')
      return result === null ? 'complex' : { scale: result, offset: 0, bitShift: null }
    }) ??
    tryMatch(s, new RegExp(`^V\\s*\\*\\s*(${NUM_RE})\\s*([+-]\\s*(?:\\d+(?:\\.\\d+)?|\\.\\d+))?$`), (m) => ({
      scale: parseFloat(m[1] ?? '1'),
      offset: m[2] ? parseFloat(m[2].replace(/\s+/g, '')) : 0,
      bitShift: null,
    })) ??
    tryMatch(s, /^V\s*([+-]\s*(?:\d+(?:\.\d+)?|\.\d+))$/, (m) => ({
      scale: 1,
      offset: parseFloat((m[1] ?? '0').replace(/\s+/g, '')),
      bitShift: null,
    })) ??
    'complex'
  )
}

// ---------------------------------------------------------------------------
// Min/max derivation from raw bit range (fallback when rangeMin/Max absent)
// ---------------------------------------------------------------------------

function computeRange(
  byteLength: number,
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

  // Extract optional baseId from <frames baseId="...">.
  // Per spec: every child frame id is added to this base (hex or decimal).
  let baseId = 0
  const framesTagMatch = /<frames\b([^>]*)>/.exec(safe)
  if (framesTagMatch) {
    const fa = getAttrs(framesTagMatch[1] ?? '')
    if (fa.baseId) {
      const parsedBase = parseHexOrDec(fa.baseId)
      if (Number.isFinite(parsedBase)) {
        baseId = parsedBase
      } else {
        warnings.push(`Ignored unparseable baseId "${fa.baseId}" (using 0)`)
      }
    }
  }

  const frameRe = /<frame\b([^>]*)>([\s\S]*?)<\/frame>/g
  let frameMatch: RegExpExecArray | null

  while ((frameMatch = frameRe.exec(safe)) !== null) {
    const frameAttrs = getAttrs(frameMatch[1] ?? '')
    const frameBody = frameMatch[2] ?? ''

    // Composite IDs (e.g. "0x3E8:5533,0,2") — take the CAN id portion only.
    const rawId = (frameAttrs.id ?? '').split(':')[0] ?? ''
    const frameIdNum = parseHexOrDec(rawId) + baseId
    if (!Number.isFinite(frameIdNum)) {
      warnings.push(`Skipped frame with unparseable id "${rawId}"`)
      continue
    }
    const canFrameId = `0x${frameIdNum.toString(16)}`

    // Frame-level defaults; per-value attrs override these.
    const frameBigEndian = resolveEndian(frameAttrs.endianess ?? frameAttrs.endianness) ?? false
    const frameSignedDefault = frameAttrs.signed === 'true'
    const timeoutMs = parseInt(frameAttrs.timeout ?? '2000', 10) || 2000

    const valueRe = /<value\b([^>]*?)(?:\s*\/>|>\s*<\/value>)/g
    let valueMatch: RegExpExecArray | null
    let valueIndex = 0

    while ((valueMatch = valueRe.exec(frameBody)) !== null) {
      const va = getAttrs(valueMatch[1] ?? '')

      // Name: explicit name → channel_{targetId} → positional fallback
      let name: string
      if (va.name) {
        name = toSnakeCase(va.name)
      } else if (va.targetId) {
        name = `channel_${va.targetId}`
      } else {
        name = `signal_${rawId.replace(/^0x/i, '')}_${String(valueIndex)}`
      }

      const startByte = parseInt(va.offset ?? '0', 10)
      const byteLength = parseInt(va.length ?? '1', 10)

      // Per-value signed / endianness override the frame-level defaults.
      const signed = va.signed !== undefined ? va.signed === 'true' : frameSignedDefault
      const valueEndian = resolveEndian(va.endianess ?? va.endianness)
      const bigEndian = valueEndian ?? frameBigEndian

      const unit = va.units ?? ''

      const conv = parseConversion(va.conversion)
      if (conv === 'complex') {
        warnings.push(
          `Skipped unsupported conversion "${va.conversion ?? ''}" on "${name}" (frame ${canFrameId})`
        )
        valueIndex++
        continue
      }

      const { scale, offset, bitShift } = conv

      let bitMask: string | undefined
      if (bitShift !== null) {
        bitMask = `0x${(1 << bitShift).toString(16).padStart(2, '0')}`
      } else if (unit === 'bit' && !va.conversion) {
        // No conversion + units="bit" → bit 0 per RealDash spec
        bitMask = '0x01'
      }

      const isBit = bitMask !== undefined

      // rangeMin/rangeMax from XML are more accurate than computed range.
      let min: number
      let max: number
      if (isBit) {
        min = 0
        max = 1
      } else if (va.rangeMin !== undefined && va.rangeMax !== undefined) {
        min = parseFloat(va.rangeMin)
        max = parseFloat(va.rangeMax)
      } else {
        ;({ min, max } = computeRange(byteLength, signed, scale, offset))
      }

      const candidate = {
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

      const parsed = SignalDefSchema.safeParse(candidate)
      if (parsed.success) {
        signals.push(parsed.data)
      } else {
        const reasons = parsed.error.issues
          .map((iss) => {
            const dotPath = iss.path.join('.')
            return dotPath ? `${dotPath}: ${iss.message}` : iss.message
          })
          .join('; ')
        warnings.push(`Rejected signal "${name}" (frame ${canFrameId}): ${reasons}`)
      }
      valueIndex++
    }
  }

  return { signals, warnings }
}
