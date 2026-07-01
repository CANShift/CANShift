import {
  DEFAULT_FRAME_TIMEOUT_MS,
  MAX_BITMASK_SHIFT_BITS,
  MAX_SIGNAL_TIMEOUT_MS,
} from '../constants/validation.js'
import { SignalDefSchema, type SignalDef } from '../schemas/signal.js'
import { escapeAttribGT, getAttrs, toSnakeCase, parseHexOrDec, resolveEndian } from './xml-lex.js'
import { parseConversion, computeRange } from './conversion-parse.js'

export interface ParseCanXmlResult {
  signals: SignalDef[]
  warnings: string[]
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
      Number.isFinite(parsedTimeout) && parsedTimeout >= 0 && parsedTimeout <= MAX_SIGNAL_TIMEOUT_MS
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

      if (bitShift !== null && bitShift > MAX_BITMASK_SHIFT_BITS) {
        warnings.push(
          `Rejected signal "${name}" (frame ${canFrameId}): bit index ${String(bitShift)} exceeds ` +
            `${String(MAX_BITMASK_SHIFT_BITS)} — bitMask must fit in 8 bits (firmware stores uint8_t)`
        )
        valueIndex++
        continue
      }

      const bitMask =
        bitShift !== null
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
