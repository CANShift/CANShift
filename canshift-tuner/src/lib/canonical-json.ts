const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) {
      out[k] = sortKeysDeep(obj[k])
    }
    return out
  }
  return value
}

export const canonicalStringify = (value: unknown): string => JSON.stringify(sortKeysDeep(value))
