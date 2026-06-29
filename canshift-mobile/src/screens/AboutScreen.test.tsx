import * as React from 'react'
import { render } from '@testing-library/react-native'
import Markdown from 'react-native-markdown-display'
import { formatBytes, formatDate } from '../lib/format'

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

describe('formatDate', () => {
  it('returns the original string for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2026-01-01T00:00:00Z')
    expect(result.length).toBeGreaterThan(0)
  })
})

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
