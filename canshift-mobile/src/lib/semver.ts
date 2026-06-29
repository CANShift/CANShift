import type { ReleaseInfo } from '@tmbk/canshift-core'

export type ComparisonKind =
  | { kind: 'unknown' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'behind'; current: string; latest: string }
  | { kind: 'ahead'; current: string; latest: string }
  | { kind: 'on-prerelease'; current: string; latestStable: string | null }

interface SemverParts {
  major: number
  minor: number
  patch: number
}

const parseSemver = (input: string): SemverParts | null => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(input.trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (![major, minor, patch].every((n) => Number.isFinite(n))) return null
  return { major, minor, patch }
}

const compareSemver = (a: SemverParts, b: SemverParts): number => {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

const isPreReleaseTag = (version: string): boolean => {
  return /[-+]/.test(version)
}

export const classify = (
  currentRaw: string | null,
  release: ReleaseInfo,
  prerelease: ReleaseInfo | null
): ComparisonKind => {
  if (currentRaw === null) return { kind: 'unknown' }
  const current = parseSemver(currentRaw)
  const latestStable = parseSemver(release.version)
  if (!current || !latestStable) return { kind: 'unknown' }

  if (isPreReleaseTag(currentRaw) || currentRaw === prerelease?.version) {
    return {
      kind: 'on-prerelease',
      current: currentRaw,
      latestStable: release.version,
    }
  }

  const delta = compareSemver(current, latestStable)
  if (delta === 0) return { kind: 'up-to-date', current: currentRaw }
  if (delta < 0) return { kind: 'behind', current: currentRaw, latest: release.version }
  return { kind: 'ahead', current: currentRaw, latest: release.version }
}

export const comparisonDetail = (comparison: ComparisonKind): string | null => {
  switch (comparison.kind) {
    case 'behind':
      return `v${comparison.current} → v${comparison.latest}`
    case 'ahead':
      return `Running v${comparison.current} (latest stable: v${comparison.latest})`
    case 'on-prerelease':
      return comparison.latestStable !== null
        ? `Running v${comparison.current} · latest stable v${comparison.latestStable}`
        : `Running v${comparison.current}`
    case 'up-to-date':
      return `v${comparison.current}`
    case 'unknown':
      return null
    default: {
      const exhaustive: never = comparison
      return exhaustive
    }
  }
}
