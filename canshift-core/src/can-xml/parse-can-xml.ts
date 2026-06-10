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

const parseHexOrDec = (s: string): number => {
  const t = s.trim()
  return t.toLowerCase().startsWith('0x') ? parseInt(t, 16) : parseInt(t, 10)
}

const resolveEndian = (raw: string | undefined): boolean | null =>
  raw ? raw.toLowerCase() === 'big' : null

interface Conversion {
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

const NUM_RE = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)'

const flattenInnerVParens = (expr: string): string =>
  expr.replace(
    new RegExp(`\\(V((?:\\s*[*/]\\s*${NUM_RE})+)\\)`, 'g'),
    (_, chain: string) => `V${chain}`
  )

const multiplyMulDivChain = (chain: string): number | null => {
  const tokens = chain.match(new RegExp(`[*/]\\s*${NUM_RE}`, 'g'))
  if (!tokens) return null
  let product = 1
  for (const token of tokens) {
    const isDivision = token.startsWith('/')
    const operand = parseFloat(token.slice(1))
    if (!Number.isFinite(operand) || (isDivision && operand === 0)) return null
    product = isDivision ? product / operand : product * operand
  }
  return product
}

const matchOrNull = <T>(
  expr: string,
  pattern: RegExp,
  build: (m: RegExpExecArray) => T
): T | null => {
  const match = pattern.exec(expr)
  return match ? build(match) : null
}

const REVERSE_SUB_RE = new RegExp(`^(${NUM_RE})\\s*-\\s*V$`)
const MUL_DIV_CHAIN_RE = new RegExp(`^V((?:\\s*[*/]\\s*${NUM_RE})+)$`)
const MUL_PLUS_OFFSET_RE = new RegExp(`^V\\s*\\*\\s*(${NUM_RE})\\s*([+-]\\s*${NUM_RE})?$`)
const ADD_OFFSET_RE = new RegExp(`^V\\s*([+-]\\s*${NUM_RE})$`)

const parseConversion = (expr: string | undefined): Conversion | 'complex' => {
  if (!expr || expr.trim() === '') return { scale: 1, offset: 0, bitShift: null }
  const normalised = flattenInnerVParens(stripOuterParens(expr.trim()))

  if (/^V$/i.test(normalised)) return { scale: 1, offset: 0, bitShift: null }

  return (
    matchOrNull<Conversion | 'complex'>(normalised, /^V\s*>>\s*(\d+)$/, (m) => ({
      scale: 1,
      offset: 0,
      bitShift: parseInt(m[1] ?? '0', 10),
    })) ??
    matchOrNull<Conversion | 'complex'>(normalised, REVERSE_SUB_RE, (m) => ({
      scale: -1,
      offset: parseFloat(m[1] ?? '0'),
      bitShift: null,
    })) ??
    matchOrNull<Conversion | 'complex'>(normalised, MUL_DIV_CHAIN_RE, (m) => {
      const product = multiplyMulDivChain(m[1] ?? '')
      return product === null ? 'complex' : { scale: product, offset: 0, bitShift: null }
    }) ??
    matchOrNull<Conversion | 'complex'>(normalised, MUL_PLUS_OFFSET_RE, (m) => ({
      scale: parseFloat(m[1] ?? '1'),
      offset: m[2] ? parseFloat(m[2].replace(/\s+/g, '')) : 0,
      bitShift: null,
    })) ??
    matchOrNull<Conversion | 'complex'>(normalised, ADD_OFFSET_RE, (m) => ({
      scale: 1,
      offset: parseFloat((m[1] ?? '0').replace(/\s+/g, '')),
      bitShift: null,
    })) ??
    'complex'
  )
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
    const timeoutMs = parseInt(frameAttrs.timeout ?? '2000', 10) || 2000

    const valueRe = /<value\b([^>]*?)(?:\s*\/>|>\s*<\/value>)/g
    let valueMatch: RegExpExecArray | null
    let valueIndex = 0

    while ((valueMatch = valueRe.exec(frameBody)) !== null) {
      const va = getAttrs(valueMatch[1] ?? '')

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
      if (conv === 'complex') {
        warnings.push(
          `Skipped unsupported conversion "${va.conversion ?? ''}" on "${name}" (frame ${canFrameId})`
        )
        valueIndex++
        continue
      }

      const { scale, offset, bitShift } = conv

      const bitMask =
        bitShift !== null
          ? `0x${(1 << bitShift).toString(16).padStart(2, '0')}`
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
