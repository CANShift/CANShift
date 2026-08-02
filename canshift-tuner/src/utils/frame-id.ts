export const parseHexFrameId = (raw: string): number => {
  const value = Number.parseInt(raw, 16)
  return Number.isNaN(value) ? -1 : value
}
