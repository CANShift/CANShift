export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

const parseSemverTuple = (version: string): [number, number, number] => {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10))
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

export const isSemverGreater = (a: string, b: string): boolean => {
  const [aMajor, aMinor, aPatch] = parseSemverTuple(a)
  const [bMajor, bMinor, bPatch] = parseSemverTuple(b)
  if (aMajor !== bMajor) return aMajor > bMajor
  if (aMinor !== bMinor) return aMinor > bMinor
  return aPatch > bPatch
}
