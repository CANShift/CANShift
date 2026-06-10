const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'mailto:'])

export const isAllowedExternalUrl = (url: unknown): boolean => {
  if (typeof url !== 'string' || url.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return ALLOWED_SCHEMES.has(parsed.protocol)
}
