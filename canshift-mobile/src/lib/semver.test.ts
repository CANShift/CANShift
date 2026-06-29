import type { ReleaseInfo } from '@tmbk/canshift-core'
import { classify, comparisonDetail } from './semver'

const STABLE: ReleaseInfo = {
  version: '1.2.0',
  tag: 'v1.2.0',
  name: null,
  prerelease: false,
  publishedAt: '2026-01-01T00:00:00Z',
  htmlUrl: 'https://github.com/example/releases/tag/v1.2.0',
  notes: '',
  assets: [],
}

describe('classify', () => {
  it('returns up-to-date when current matches stable', () => {
    expect(classify('1.2.0', STABLE, null).kind).toBe('up-to-date')
  })

  it('returns behind when current is older than latest', () => {
    expect(classify('1.1.0', STABLE, null).kind).toBe('behind')
  })

  it('returns ahead when current is newer than latest', () => {
    expect(classify('1.3.0', STABLE, null).kind).toBe('ahead')
  })

  it('returns unknown for null current version', () => {
    expect(classify(null, STABLE, null).kind).toBe('unknown')
  })

  it('returns unknown for an unparseable current version', () => {
    expect(classify('not-a-version', STABLE, null).kind).toBe('unknown')
  })

  it('returns on-prerelease for a prerelease tag', () => {
    expect(classify('1.2.0-beta.1', STABLE, null).kind).toBe('on-prerelease')
  })

  it('compares minor and patch components', () => {
    expect(classify('1.2.1', STABLE, null).kind).toBe('ahead')
    expect(classify('1.1.9', STABLE, null).kind).toBe('behind')
  })
})

describe('comparisonDetail', () => {
  it('describes a behind comparison as an upgrade arrow', () => {
    expect(comparisonDetail({ kind: 'behind', current: '1.1.0', latest: '1.2.0' })).toBe(
      'v1.1.0 → v1.2.0'
    )
  })

  it('returns null for unknown', () => {
    expect(comparisonDetail({ kind: 'unknown' })).toBeNull()
  })

  it('handles on-prerelease with and without a latest stable', () => {
    expect(
      comparisonDetail({ kind: 'on-prerelease', current: '1.2.0-beta.1', latestStable: '1.1.0' })
    ).toContain('latest stable v1.1.0')
    expect(
      comparisonDetail({ kind: 'on-prerelease', current: '1.2.0-beta.1', latestStable: null })
    ).toBe('Running v1.2.0-beta.1')
  })
})
