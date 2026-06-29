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

export { escapeAttribGT, getAttrs, toSnakeCase, parseHexOrDec, resolveEndian }
