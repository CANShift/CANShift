import {
  DEFAULT_FRAME_TIMEOUT_MS,
  MAX_EXPR_LENGTH,
  SAFE_EXPR_REGEX,
  isValidShiftCount,
} from '../constants/validation.js'
import { SignalDefSchema, type SignalDef } from '../schemas/signal.js'

export interface ParseCanXmlResult {
  signals: SignalDef[]
  warnings: string[]
}

const GT_PUA = ''
const GT_PUA_RE = //g

const escapeAttribGT = (xml: string): string =>
  xml.replace(/"[^"]*"/g, (match) => match.replace(/>/g, GT_PUA))

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const decodeAttrValue = (s: string): string =>
  s
    .replace(GT_PUA_RE, '>')
    .replace(/&(amp|lt|gt|quot|apos);/g, (match, name: string) => XML_ENTITY_MAP[name] ?? match)

const getAttrs = (tag: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag)) !== null) {
    const key = m[1]
    const val = m[2]
    if (key !== undefined && val !== undefined) attrs[key] = decodeAttrValue(val)
  }
  return attrs
}

const toSnakeCase = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const HEX_LITERAL_RE = /^[0-9a-fA-F]+$/
const HAS_HEX_LETTER_RE = /[a-fA-F]/

const parseHexOrDec = (s: string): number => {
  const t = s.trim()
  if (t === '') return NaN
  if (t.toLowerCase().startsWith('0x')) return parseInt(t.slice(2), 16)
  if (HEX_LITERAL_RE.test(t) && HAS_HEX_LETTER_RE.test(t)) return parseInt(t, 16)
  return parseInt(t, 10)
}

const resolveEndian = (raw: string | undefined): boolean | null =>
  raw ? raw.toLowerCase() === 'big' : null

interface Conversion {
  kind: 'linear'
  scale: number
  offset: number
  bitShift: number | null
}

const isFullyParenWrapped = (expr: string): boolean => {
  let depth = 0
  for (let i = 0; i < expr.length - 1; i++) {
    depth += expr[i] === '(' ? 1 : expr[i] === ')' ? -1 : 0
    if (depth === 0) return false
  }
  return true
}

const stripOuterParens = (expr: string): string => {
  let current = expr.trim()
  while (current.startsWith('(') && current.endsWith(')') && isFullyParenWrapped(current)) {
    current = current.slice(1, -1).trim()
  }
  return current
}

const BIDI_MARKS_RE = /[\u202A-\u202E\u2066-\u2069]/g
const BIT_SHIFT_RE = /^V\s*>>\s*(\d+)$/
const BIT_AND_RE = /^V\s*&\s*(0x[0-9a-fA-F]+|\d+)$/
const BIT_SHIFT_AND_ONE_RE = /^\(?\s*V\s*>>\s*(\d+)\s*\)?\s*&\s*1$/
const LEFT_SHIFT_RE = /V\s*<<\s*(\d+)/g
const IMPLICIT_MUL_AFTER_V_RE = /V(?=[\d(])/g
const IMPLICIT_MUL_BEFORE_V_RE = /([\d)])(?=V)/g

const log2Int = (n: number): number | null => {
  if (n <= 0 || !Number.isInteger(n)) return null
  const lg = Math.log2(n)
  return Number.isInteger(lg) ? lg : null
}

const hasOutOfRangeShift = (expr: string): boolean => {
  for (const match of expr.matchAll(LEFT_SHIFT_RE)) {
    if (!isValidShiftCount(parseInt(match[1] ?? '', 10))) return true
  }
  return false
}

const normaliseExpr = (expr: string): string | null => {
  const withoutBidi = expr.replace(BIDI_MARKS_RE, '')
  const upperV = withoutBidi.replace(/v/g, 'V')
  if (hasOutOfRangeShift(upperV)) return null
  const expandedShifts = upperV.replace(
    LEFT_SHIFT_RE,
    (_, n: string) => `V*${String(2 ** parseInt(n, 10))}`
  )
  return expandedShifts
    .replace(IMPLICIT_MUL_AFTER_V_RE, 'V*')
    .replace(IMPLICIT_MUL_BEFORE_V_RE, '$1*V')
}

const tokeniseArith = (expr: string): string[] | null => {
  const tokens: string[] = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i] ?? ''
    if (/\s/.test(c)) {
      i++
      continue
    }
    if ('()+-*/'.includes(c)) {
      tokens.push(c)
      i++
      continue
    }
    if (c === 'V') {
      tokens.push('V')
      i++
      continue
    }
    if (/[\d.]/.test(c)) {
      let j = i
      while (j < expr.length && /[\d.]/.test(expr[j] ?? '')) j++
      tokens.push(expr.slice(i, j))
      i = j
      continue
    }
    return null
  }
  return tokens
}

type Evaluator = (v: number) => number

const buildEvaluator = (tokens: string[]): Evaluator | null => {
  let pos = 0

  const parsePrimary = (): Evaluator | null => {
    const t = tokens[pos]
    if (t === undefined) return null
    if (t === '(') {
      pos++
      const inner = parseAddSub()
      if (inner === null || tokens[pos] !== ')') return null
      pos++
      return inner
    }
    if (t === '+') {
      pos++
      return parsePrimary()
    }
    if (t === '-') {
      pos++
      const inner = parsePrimary()
      return inner === null ? null : (v) => -inner(v)
    }
    if (t === 'V') {
      pos++
      return (v) => v
    }
    const n = parseFloat(t)
    if (!Number.isFinite(n)) return null
    pos++
    return () => n
  }

  const parseMulDiv = (): Evaluator | null => {
    let left = parsePrimary()
    while (left !== null && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos]
      pos++
      const right = parsePrimary()
      if (right === null) return null
      const L = left
      const R = right
      left = op === '*' ? (v) => L(v) * R(v) : (v) => L(v) / R(v)
    }
    return left
  }

  const parseAddSub = (): Evaluator | null => {
    let left = parseMulDiv()
    while (left !== null && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos]
      pos++
      const right = parseMulDiv()
      if (right === null) return null
      const L = left
      const R = right
      left = op === '+' ? (v) => L(v) + R(v) : (v) => L(v) - R(v)
    }
    return left
  }

  const root = parseAddSub()
  if (root === null || pos !== tokens.length) return null
  return root
}

const LINEARITY_EPSILON = 1e-9

const tryLinearInV = (expr: string): Conversion | null => {
  const tokens = tokeniseArith(expr)
  if (!tokens || tokens.length === 0) return null
  const evaluator = buildEvaluator(tokens)
  if (!evaluator) return null
  const a0 = evaluator(0)
  const a1 = evaluator(1)
  const a2 = evaluator(2)
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(a2)) return null
  const scale = a1 - a0
  const offset = a0
  const expectedA2 = 2 * scale + offset
  const tolerance = LINEARITY_EPSILON * Math.max(1, Math.abs(a2), Math.abs(expectedA2))
  if (Math.abs(a2 - expectedA2) > tolerance) return null
  return {
    kind: 'linear',
    scale: normaliseZero(scale),
    offset: normaliseZero(offset),
    bitShift: null,
  }
}

const normaliseZero = (n: number): number => (Object.is(n, -0) ? 0 : n)

const matchBitExtract = (expr: string): Conversion | null => {
  const shiftMatch = BIT_SHIFT_RE.exec(expr) ?? BIT_SHIFT_AND_ONE_RE.exec(expr)
  if (shiftMatch) {
    return { kind: 'linear', scale: 1, offset: 0, bitShift: parseInt(shiftMatch[1] ?? '0', 10) }
  }
  const andMatch = BIT_AND_RE.exec(expr)
  if (andMatch) {
    const raw = andMatch[1] ?? '0'
    const mask = raw.toLowerCase().startsWith('0x') ? parseInt(raw.slice(2), 16) : parseInt(raw, 10)
    const bit = log2Int(mask)
    if (bit !== null) return { kind: 'linear', scale: 1, offset: 0, bitShift: bit }
  }
  return null
}

interface ExprEmission {
  kind: 'expr'
  expr: string
}

interface ParseRejection {
  kind: 'cross-signal' | 'invalid'
}

type ParseConversionResult = Conversion | ExprEmission | ParseRejection

const CROSS_SIGNAL_REF_RE = /\bID\d+\b/i

const tryEmitExpr = (raw: string): ExprEmission | ParseRejection => {
  const normalised = normaliseExpr(raw)
  if (normalised === null) return { kind: 'invalid' }
  const cleaned = normalised.replace(/(?<![<>=!])=(?!=)/g, '==')
  if (CROSS_SIGNAL_REF_RE.test(cleaned)) return { kind: 'cross-signal' }
  if (!SAFE_EXPR_REGEX.test(cleaned)) return { kind: 'invalid' }
  const compact = cleaned.replace(/\s+/g, ' ').trim()
  if (compact.length === 0 || compact.length > MAX_EXPR_LENGTH) return { kind: 'invalid' }
  return { kind: 'expr', expr: compact }
}

const parseConversion = (expr: string | undefined): ParseConversionResult => {
  if (!expr || expr.trim() === '') return { kind: 'linear', scale: 1, offset: 0, bitShift: null }
  const stripped = stripOuterParens(expr.trim())
  const bitExtract = matchBitExtract(stripped)
  if (bitExtract) return bitExtract
  const normalised = normaliseExpr(stripped)
  const linear = normalised === null ? null : tryLinearInV(normalised)
  if (linear) return linear
  return tryEmitExpr(stripped)
}

const computeRange = (
  byteLength: number,
  signed: boolean,
  scale: number,
  offset: number
): { min: number; max: number } => {
  const bits = byteLength * 8
  const rawMax = signed ? Math.pow(2, bits - 1) - 1 : Math.pow(2, bits) - 1
  const rawMin = signed ? -Math.pow(2, bits - 1) : 0
  const lo = Math.round((scale * rawMin + offset) * 100) / 100
  const hi = Math.round((scale * rawMax + offset) * 100) / 100
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) }
}

export const parseCanXml = (xml: string): ParseCanXmlResult => {
  const signals: SignalDef[] = []
  const warnings: string[] = []

  if (!xml.includes('<RealDashCAN')) {
    return { signals, warnings: ['Not a supported CAN XML file (missing root tag)'] }
  }

  const safe = escapeAttribGT(xml)

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

    const rawId = (frameAttrs.id ?? '').split(':')[0] ?? ''
    const frameIdNum = parseHexOrDec(rawId) + baseId
    if (!Number.isFinite(frameIdNum)) {
      if (rawId !== '') warnings.push(`Skipped frame with unparseable id "${rawId}"`)
      continue
    }
    const canFrameId = `0x${frameIdNum.toString(16)}`

    const frameBigEndian = resolveEndian(frameAttrs.endianess ?? frameAttrs.endianness) ?? false
    const frameSignedDefault = frameAttrs.signed === 'true'
    const parsedTimeout = parseInt(frameAttrs.timeout ?? '', 10)
    const timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout >= 0
        ? parsedTimeout
        : DEFAULT_FRAME_TIMEOUT_MS

    const valueRe = /<value\b([^>]*?)(?:\s*\/>|>\s*<\/value>)/g
    let valueMatch: RegExpExecArray | null
    let valueIndex = 0

    while ((valueMatch = valueRe.exec(frameBody)) !== null) {
      const va = getAttrs(valueMatch[1] ?? '')

      if (va.targetId === 'placeholder' || va.conversion === 'placeholder') {
        valueIndex++
        continue
      }

      const name = va.name
        ? toSnakeCase(va.name)
        : va.targetId
          ? `channel_${va.targetId}`
          : `signal_${rawId.replace(/^0x/i, '')}_${String(valueIndex)}`

      const startByte = parseInt(va.offset ?? '0', 10)
      const byteLength = parseInt(va.length ?? '1', 10)

      const signed = va.signed !== undefined ? va.signed === 'true' : frameSignedDefault
      const valueEndian = resolveEndian(va.endianess ?? va.endianness)
      const bigEndian = valueEndian ?? frameBigEndian

      const unit = va.units ?? ''

      const conv = parseConversion(va.conversion)
      if (conv.kind === 'cross-signal') {
        warnings.push(
          `Cross-signal expression "${va.conversion ?? ''}" on "${name}" (frame ${canFrameId}) — deferred to v2`
        )
        valueIndex++
        continue
      }
      if (conv.kind === 'invalid') {
        warnings.push(
          `Skipped unsupported conversion "${va.conversion ?? ''}" on "${name}" (frame ${canFrameId})`
        )
        valueIndex++
        continue
      }

      const scale = conv.kind === 'linear' ? conv.scale : 1
      const offset = conv.kind === 'linear' ? conv.offset : 0
      const bitShift = conv.kind === 'linear' ? conv.bitShift : null
      const exprText = conv.kind === 'expr' ? conv.expr : undefined

      const bitMask =
        bitShift !== null && isValidShiftCount(bitShift)
          ? `0x${(2 ** bitShift).toString(16).padStart(2, '0')}`
          : unit === 'bit' && !va.conversion
            ? '0x01'
            : undefined

      const isBit = bitMask !== undefined

      const explicitRange =
        va.rangeMin !== undefined && va.rangeMax !== undefined
          ? { min: parseFloat(va.rangeMin), max: parseFloat(va.rangeMax) }
          : null
      const { min, max } = isBit
        ? { min: 0, max: 1 }
        : (explicitRange ?? computeRange(byteLength, signed, scale, offset))

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
        ...(exprText !== undefined ? { expr: exprText } : {}),
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
