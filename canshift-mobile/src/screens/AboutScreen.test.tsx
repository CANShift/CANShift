// AboutScreen.test.tsx — Pure helper unit tests + markdown rendering smoke test.

import * as React from 'react'
import { render } from '@testing-library/react-native'
import Markdown from 'react-native-markdown-display'
import { classify, formatBytes, formatDate } from './AboutScreen'

const STABLE: import('../services/releases.types').ReleaseInfo = {
  version: '1.2.0',
  tag: 'v1.2.0',
  name: null,
  prerelease: false,
  publishedAt: '2026-01-01T00:00:00Z',
  htmlUrl: 'https://github.com/example/releases/tag/v1.2.0',
  notes: '',
  assets: [],
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------

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

  it('returns on-prerelease for a prerelease tag', () => {
    expect(classify('1.2.0-beta.1', STABLE, null).kind).toBe('on-prerelease')
  })
})

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('formats bytes as-is below 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats KB correctly', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats MB correctly', () => {
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('returns the original string for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2026-01-01T00:00:00Z')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

describe('Markdown notes rendering', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Markdown>{'# Hello\n\n- item one\n- item two'}</Markdown>)
    expect(toJSON()).toBeTruthy()
  })

  it('renders inline code spans', () => {
    const { toJSON } = render(<Markdown>{'Use `npm install` to install.'}</Markdown>)
    expect(toJSON()).toBeTruthy()
  })
})
