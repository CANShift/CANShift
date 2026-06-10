export const mapObjectKeys = <Source extends Record<string, unknown>>(
  source: Source,
  keyMap: Partial<Record<keyof Source, string>>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (value === undefined) continue
    const renamed = (keyMap as Record<string, string | undefined>)[key]
    out[renamed ?? key] = value
  }
  return out
}
