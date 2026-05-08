// SafeMarkdown.tsx — Sanitized Markdown renderer for untrusted input (issue #300).
//
// Renders Markdown via react-markdown — output is React elements, never raw
// HTML strings, so we never touch `dangerouslySetInnerHTML`. The lint guard
// from issue #240 (`lint:no-unsafe-html`) keeps holding.
//
// Defense in depth:
// - `remark-gfm` adds GitHub-flavored tables / task lists / strikethrough.
// - `rehype-sanitize` with the default GitHub schema strips `<script>`,
//   event handlers, `javascript:` URLs, and any tag/attr not on the
//   allowlist. We do NOT use `rehype-raw`, so embedded HTML in the source
//   Markdown is escaped, not parsed (matches the security note in
//   `useUpdater.ts` for #240).
// - External anchors are rendered with `target="_blank"` and `rel="noopener
//   noreferrer"`; the Electron main process intercepts window-open via
//   `setWindowOpenHandler` and routes the URL through `isExternalUrlAllowed`
//   before handing it to `shell.openExternal` (see `main/index.ts`).
//
// The component renders into a single `<div>` styled with Tailwind tokens
// (`text-text`, `text-text-muted`, `border-border`, `bg-surface-2`). No new
// design tokens are introduced.

import { memo } from 'react'
import type { JSX, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface SafeMarkdownProps {
  source: string
  className?: string | undefined
}

interface RendererProps {
  children?: ReactNode
}

interface AnchorProps extends RendererProps {
  href?: string | undefined
}

interface CodeProps extends RendererProps {
  className?: string | undefined
}

const components: Components = {
  h1: ({ children }: RendererProps): JSX.Element => (
    <h1 className="text-text mt-3 mb-2 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: RendererProps): JSX.Element => (
    <h2 className="text-text mt-3 mb-2 text-sm font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: RendererProps): JSX.Element => (
    <h3 className="text-text mt-2 mb-1 text-xs font-semibold uppercase tracking-wide first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }: RendererProps): JSX.Element => (
    <h4 className="text-text mt-2 mb-1 text-xs font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }: RendererProps): JSX.Element => (
    <p className="text-text-muted my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: RendererProps): JSX.Element => (
    <ul className="text-text-muted my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: RendererProps): JSX.Element => (
    <ol className="text-text-muted my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: RendererProps): JSX.Element => (
    <li className="text-text-muted leading-relaxed">{children}</li>
  ),
  a: ({ href, children }: AnchorProps): JSX.Element => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }: CodeProps): JSX.Element => {
    const isBlock = typeof className === 'string' && className.startsWith('language-')
    if (isBlock) {
      return <code className={`${className} font-mono text-xs`}>{children}</code>
    }
    return (
      <code className="bg-surface-2 text-text rounded px-1 py-0.5 font-mono text-xs">
        {children}
      </code>
    )
  },
  pre: ({ children }: RendererProps): JSX.Element => (
    <pre className="bg-surface-2 border-border my-2 overflow-x-auto rounded border p-2 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }: RendererProps): JSX.Element => (
    <blockquote className="border-border text-text-muted my-2 border-l-2 pl-3 italic">
      {children}
    </blockquote>
  ),
  hr: (): JSX.Element => <hr className="border-border my-3" />,
  table: ({ children }: RendererProps): JSX.Element => (
    <div className="my-2 overflow-x-auto">
      <table className="border-border w-full border-collapse border text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: RendererProps): JSX.Element => (
    <th className="border-border bg-surface-2 text-text border px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: RendererProps): JSX.Element => (
    <td className="border-border text-text-muted border px-2 py-1">{children}</td>
  ),
  strong: ({ children }: RendererProps): JSX.Element => (
    <strong className="text-text font-semibold">{children}</strong>
  ),
  em: ({ children }: RendererProps): JSX.Element => (
    <em className="text-text-muted italic">{children}</em>
  ),
}

function SafeMarkdownImpl({ source, className }: SafeMarkdownProps): JSX.Element {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        disallowedElements={['script', 'style', 'iframe', 'object', 'embed', 'form']}
        components={components}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

export const SafeMarkdown = memo(SafeMarkdownImpl)
