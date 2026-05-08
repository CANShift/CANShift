// markdown-to-plain-text.test.ts — XSS-resistance + bounding for issue #240.
//
// Locks the contract that release-note input from electron-updater is reduced
// to inert plain text before it ever crosses the IPC boundary.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { markdownToPlainText } from './markdown-to-plain-text'

describe('markdownToPlainText — sanitize untrusted release notes', () => {
  it('returns empty string for null / undefined / empty input', () => {
    expect(markdownToPlainText(null)).toBe('')
    expect(markdownToPlainText(undefined)).toBe('')
    expect(markdownToPlainText('')).toBe('')
    expect(markdownToPlainText('   \n\t  ')).toBe('')
  })

  it('strips <script> tags and their payload entirely', () => {
    const input = 'Hello<script>alert(1)</script> world'
    expect(markdownToPlainText(input)).toBe('Hello world')
  })

  it('strips <style> blocks and HTML comments', () => {
    expect(markdownToPlainText('a<style>body{}</style>b')).toBe('a b')
    expect(markdownToPlainText('a<!-- evil -->b')).toBe('a b')
  })

  it('drops img tags including onerror handlers', () => {
    const input = '<img src=x onerror="alert(1)">caption'
    expect(markdownToPlainText(input)).toBe('caption')
  })

  it('strips arbitrary HTML tags and attributes', () => {
    expect(markdownToPlainText('<a href="javascript:alert(1)">click</a>')).toBe('click')
    expect(markdownToPlainText('<b>bold</b> <i>italic</i>')).toBe('bold italic')
  })

  it('reduces markdown headings, lists, blockquotes and emphasis to plain text', () => {
    const input = [
      '# Title',
      '## Subtitle',
      '- bullet one',
      '- bullet two',
      '1. ordered',
      '> quoted',
      '**bold** and _italic_ and ~~strike~~',
    ].join('\n')
    expect(markdownToPlainText(input)).toBe(
      'Title Subtitle bullet one bullet two ordered quoted bold and italic and strike'
    )
  })

  it('keeps link labels and image alt text without URLs', () => {
    expect(markdownToPlainText('see [docs](https://example.com)')).toBe('see docs')
    expect(markdownToPlainText('![alt](https://x/y.png)')).toBe('alt')
  })

  it('strips inline and fenced code while keeping the literal text', () => {
    expect(markdownToPlainText('use `npm run build` to compile')).toBe(
      'use npm run build to compile'
    )
    expect(markdownToPlainText('```\ncode\n```')).toBe('code')
  })

  it('decodes a small allowlist of HTML entities', () => {
    expect(markdownToPlainText('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(markdownToPlainText('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0')
    expect(markdownToPlainText('&#65;&#x42;')).toBe('AB')
  })

  it('decodes entities to literal text without re-introducing live HTML', () => {
    // Entities decode AFTER tag stripping. The string "<script>" survives as
    // plain text, but the renderer never feeds this field to innerHTML, so
    // the angle brackets are inert. The contract is: the value is a string,
    // not an HTML fragment.
    const input = '&lt;script&gt;alert(1)&lt;/script&gt;'
    expect(markdownToPlainText(input)).toBe('<script>alert(1)</script>')
  })

  it('strips a real <script> tag even when it surrounds entity-encoded payload', () => {
    const input = '<script>&#97;lert(1)</script>after'
    expect(markdownToPlainText(input)).toBe('after')
  })

  it('collapses whitespace and trims', () => {
    expect(markdownToPlainText('  a   \n\n  b  \t  c  ')).toBe('a b c')
  })

  it('caps output length at 4000 chars with a trailing ellipsis marker', () => {
    const longInput = 'x'.repeat(10_000)
    const out = markdownToPlainText(longInput)
    expect(out.length).toBe(4000)
    expect(out.endsWith('...')).toBe(true)
  })

  it('flattens an array of ReleaseNoteInfo entries', () => {
    const out = markdownToPlainText([
      { version: '1.0.0', note: '# First\n- one' },
      { version: '1.1.0', note: '## Second\n- two' },
      { version: '1.2.0', note: null },
    ])
    expect(out).toBe('1.0.0 First one 1.1.0 Second two')
  })

  it('returns empty string for unsupported shapes', () => {
    // @ts-expect-error runtime guard for unexpected inputs from upstream lib
    expect(markdownToPlainText(42)).toBe('')
    // @ts-expect-error runtime guard for unexpected inputs from upstream lib
    expect(markdownToPlainText({})).toBe('')
  })
})
