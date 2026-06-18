export interface EvalContext {
  v: number
  bytes: ReadonlyArray<number>
}

interface Token {
  kind: 'num' | 'id' | 'op'
  text: string
}

const OPERATORS = [
  '<<',
  '>>',
  '==',
  '!=',
  '<=',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '<',
  '>',
  '!',
  '(',
  ')',
  ',',
] as const

const tokenise = (expr: string): Token[] | null => {
  const out: Token[] = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i] ?? ''
    if (/\s/.test(c)) {
      i++
      continue
    }
    let matched = false
    for (const op of OPERATORS) {
      if (expr.startsWith(op, i)) {
        out.push({ kind: 'op', text: op })
        i += op.length
        matched = true
        break
      }
    }
    if (matched) continue
    if (c === '0' && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
      let j = i + 2
      while (j < expr.length && /[0-9a-fA-F]/.test(expr[j] ?? '')) j++
      out.push({ kind: 'num', text: expr.slice(i, j) })
      i = j
      continue
    }
    if (/[\d.]/.test(c)) {
      let j = i
      while (j < expr.length && /[\d.]/.test(expr[j] ?? '')) j++
      out.push({ kind: 'num', text: expr.slice(i, j) })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < expr.length && /[\w]/.test(expr[j] ?? '')) j++
      out.push({ kind: 'id', text: expr.slice(i, j) })
      i = j
      continue
    }
    return null
  }
  return out
}

const parseNumber = (text: string): number =>
  text.startsWith('0x') || text.startsWith('0X') ? parseInt(text.slice(2), 16) : parseFloat(text)

const readByte = (ctx: EvalContext, index: number): number => ctx.bytes[index] ?? 0

interface ParseState {
  tokens: Token[]
  pos: number
}

const peek = (s: ParseState): Token | undefined => s.tokens[s.pos]

const eat = (s: ParseState, op: string): boolean => {
  const t = peek(s)
  if (t?.kind === 'op' && t.text === op) {
    s.pos++
    return true
  }
  return false
}

type ExprFn = (ctx: EvalContext) => number

const parseOrExpr = (s: ParseState): ExprFn | null => {
  let left = parseXorExpr(s)
  while (left !== null && peek(s)?.text === '|') {
    s.pos++
    const right = parseXorExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = (c) => (Math.trunc(L(c)) | Math.trunc(R(c))) >>> 0
  }
  return left
}

const parseXorExpr = (s: ParseState): ExprFn | null => {
  let left = parseAndExpr(s)
  while (left !== null && peek(s)?.text === '^') {
    s.pos++
    const right = parseAndExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = (c) => (Math.trunc(L(c)) ^ Math.trunc(R(c))) >>> 0
  }
  return left
}

const parseAndExpr = (s: ParseState): ExprFn | null => {
  let left = parseEqExpr(s)
  while (left !== null && peek(s)?.text === '&') {
    s.pos++
    const right = parseEqExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = (c) => (Math.trunc(L(c)) & Math.trunc(R(c))) >>> 0
  }
  return left
}

const parseEqExpr = (s: ParseState): ExprFn | null => {
  let left = parseRelExpr(s)
  while (left !== null && (peek(s)?.text === '==' || peek(s)?.text === '!=')) {
    const op = peek(s)?.text ?? ''
    s.pos++
    const right = parseRelExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = op === '==' ? (c) => (L(c) === R(c) ? 1 : 0) : (c) => (L(c) !== R(c) ? 1 : 0)
  }
  return left
}

const parseRelExpr = (s: ParseState): ExprFn | null => {
  let left = parseShiftExpr(s)
  while (
    left !== null &&
    (peek(s)?.text === '<' ||
      peek(s)?.text === '<=' ||
      peek(s)?.text === '>' ||
      peek(s)?.text === '>=')
  ) {
    const op = peek(s)?.text ?? ''
    s.pos++
    const right = parseShiftExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left =
      op === '<'
        ? (c) => (L(c) < R(c) ? 1 : 0)
        : op === '<='
          ? (c) => (L(c) <= R(c) ? 1 : 0)
          : op === '>'
            ? (c) => (L(c) > R(c) ? 1 : 0)
            : (c) => (L(c) >= R(c) ? 1 : 0)
  }
  return left
}

const parseShiftExpr = (s: ParseState): ExprFn | null => {
  let left = parseAddExpr(s)
  while (left !== null && (peek(s)?.text === '<<' || peek(s)?.text === '>>')) {
    const op = peek(s)?.text ?? ''
    s.pos++
    const right = parseAddExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left =
      op === '<<'
        ? (c) => (Math.trunc(L(c)) << Math.trunc(R(c))) >>> 0
        : (c) => Math.trunc(L(c)) >>> Math.trunc(R(c))
  }
  return left
}

const parseAddExpr = (s: ParseState): ExprFn | null => {
  let left = parseMulExpr(s)
  while (left !== null && (peek(s)?.text === '+' || peek(s)?.text === '-')) {
    const op = peek(s)?.text ?? ''
    s.pos++
    const right = parseMulExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = op === '+' ? (c) => L(c) + R(c) : (c) => L(c) - R(c)
  }
  return left
}

const parseMulExpr = (s: ParseState): ExprFn | null => {
  let left = parseUnaryExpr(s)
  while (
    left !== null &&
    (peek(s)?.text === '*' || peek(s)?.text === '/' || peek(s)?.text === '%')
  ) {
    const op = peek(s)?.text ?? ''
    s.pos++
    const right = parseUnaryExpr(s)
    if (right === null) return null
    const L = left
    const R = right
    left = op === '*' ? (c) => L(c) * R(c) : op === '/' ? (c) => L(c) / R(c) : (c) => L(c) % R(c)
  }
  return left
}

const parseUnaryExpr = (s: ParseState): ExprFn | null => {
  const t = peek(s)
  if (t?.kind === 'op' && (t.text === '+' || t.text === '-' || t.text === '!')) {
    s.pos++
    const inner = parseUnaryExpr(s)
    if (inner === null) return null
    const I = inner
    if (t.text === '-') return (c) => -I(c)
    if (t.text === '!') return (c) => (I(c) === 0 ? 1 : 0)
    return I
  }
  return parsePrimary(s)
}

const FN_NAMES = new Set(['Floor', 'Ceil', 'Round'])

const parsePrimary = (s: ParseState): ExprFn | null => {
  const t = peek(s)
  if (t === undefined) return null
  if (t.kind === 'op' && t.text === '(') {
    s.pos++
    const inner = parseOrExpr(s)
    if (inner === null || !eat(s, ')')) return null
    return inner
  }
  if (t.kind === 'num') {
    const n = parseNumber(t.text)
    if (!Number.isFinite(n)) return null
    s.pos++
    return () => n
  }
  if (t.kind === 'id') {
    if (t.text === 'V') {
      s.pos++
      return (c) => c.v
    }
    if (/^B[0-7]$/.test(t.text)) {
      const idx = parseInt(t.text.slice(1), 10)
      s.pos++
      return (c) => readByte(c, idx)
    }
    if (FN_NAMES.has(t.text)) {
      s.pos++
      if (!eat(s, '(')) return null
      const arg = parseOrExpr(s)
      if (arg === null || !eat(s, ')')) return null
      const A = arg
      if (t.text === 'Floor') return (c) => Math.floor(A(c))
      if (t.text === 'Ceil') return (c) => Math.ceil(A(c))
      return (c) => Math.round(A(c))
    }
    return null
  }
  return null
}

export const compileExpr = (expr: string): ExprFn | null => {
  const tokens = tokenise(expr)
  if (!tokens || tokens.length === 0) return null
  const state: ParseState = { tokens, pos: 0 }
  const root = parseOrExpr(state)
  if (root === null || state.pos !== tokens.length) return null
  return root
}

export const evalExpr = (expr: string, ctx: EvalContext): number => {
  const fn = compileExpr(expr)
  if (!fn) return 0
  const result = fn(ctx)
  return Number.isFinite(result) ? result : 0
}
