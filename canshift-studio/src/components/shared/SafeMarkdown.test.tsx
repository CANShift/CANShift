// SafeMarkdown.test.tsx — sanitization contract tests for issue #300.
//
// We use `react-dom/server` to render to static HTML; this avoids pulling
// in @testing-library/react (kept out of the repo on purpose) while still
// exercising the full react-markdown + rehype-sanitize pipeline.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SafeMarkdown } from './SafeMarkdown'

function render(source: string): string {
  return renderToStaticMarkup(<SafeMarkdown source={source} />)
}

describe('SafeMarkdown — formatting', () => {
  it('renders headings, lists, and inline code', () => {
    const html = render('# Title\n\n- one\n- two\n\nUse `npm` to install.')
    expect(html).toContain('<h1')
    expect(html).toContain('Title')
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('one')
    expect(html).toContain('<code')
    expect(html).toContain('npm')
  })

  it('renders fenced code blocks inside <pre>', () => {
    const html = render('```ts\nconst a = 1\n```')
    expect(html).toContain('<pre')
    expect(html).toContain('const a = 1')
  })

  it('renders GitHub-flavored markdown (tables, task lists, strikethrough)', () => {
    const table = '| h1 | h2 |\n| --- | --- |\n| a | b |'
    const tableHtml = render(table)
    expect(tableHtml).toContain('<table')
    expect(tableHtml).toContain('<th')
    expect(tableHtml).toContain('h1')

    const tasks = '- [x] done\n- [ ] todo'
    const tasksHtml = render(tasks)
    expect(tasksHtml).toContain('checkbox')

    expect(render('~~gone~~')).toContain('<del')
  })

  it('opens external links in a new window with rel=noopener noreferrer', () => {
    const html = render('See [docs](https://example.com).')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('SafeMarkdown — sanitization (XSS hardening)', () => {
  it('strips raw <script> tags so they cannot execute', () => {
    // skipHtml + rehype-sanitize removes the <script> element entirely; the
    // payload is collapsed to text content (visible, but not executable).
    const html = render('hello <script>alert(1)</script> world')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('</script>')
  })

  it('escapes raw HTML event handlers', () => {
    const html = render('<img src=x onerror="alert(1)" />')
    expect(html).not.toContain('onerror')
    expect(html).not.toMatch(/alert\(1\)/)
  })

  it('strips javascript: URLs from links', () => {
    const html = render('[click](javascript:alert(1))')
    // rehype-sanitize removes the unsafe href entirely.
    expect(html).not.toMatch(/href="javascript:/i)
    expect(html).not.toMatch(/alert\(1\)/)
  })

  it('escapes <iframe> embeds', () => {
    const html = render('<iframe src="https://evil.example"></iframe>')
    expect(html).not.toContain('<iframe')
  })

  it('escapes <style> blocks (CSP-relevant)', () => {
    const html = render('<style>body{display:none}</style>')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('display:none')
  })
})
