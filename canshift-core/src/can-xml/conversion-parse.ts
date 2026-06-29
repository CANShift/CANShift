import { MAX_EXPR_LENGTH, SAFE_EXPR_REGEX, isValidShiftCount } from '../constants/validation.js'

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

export { parseConversion, computeRange }
export type { ParseConversionResult }
