// markdown-to-plain-text.ts — Strip untrusted markdown/HTML to bounded plain text.
//
// Used to sanitize `info.releaseNotes` from electron-updater (the GitHub release
// body, untrusted upstream content) before forwarding it to the renderer over
// IPC. Returning plain text means there is no XSS surface even if a future
// "What's new" dialog renders the field — `<script>` tags, `<img onerror>`,
// `javascript:` URLs and HTML entities all reduce to inert text.
//
// Deliberately tiny and dependency-free: a battle-tested sanitizer (sanitize-html,
// DOMPurify) is overkill for a field we only ever want as plain text. If we
// later want formatted output, that's a separate decision behind a real
// sanitizer + react-markdown with `disallowedElements: ['script']` and NO
// `rehype-raw`.

import type { ReleaseNoteInfo } from 'builder-util-runtime'

const MAX_PLAIN_TEXT_LENGTH = 4000
const TRUNCATION_SUFFIX = '...'

const HTML_ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Convert untrusted markdown (or HTML, or a mix) into bounded plain text.
 * - Strips all HTML tags and markdown markup.
 * - Decodes a small set of common HTML entities; unknown entities stay literal.
 * - Collapses whitespace and trims.
 * - Caps at `MAX_PLAIN_TEXT_LENGTH` characters with a trailing "..." marker.
 *
 * The shape mirrors `UpdateInfo.releaseNotes` from builder-util-runtime:
 * `string | ReleaseNoteInfo[] | null | undefined`. Anything else returns "".
 */
export function markdownToPlainText(
  input: string | readonly ReleaseNoteInfo[] | null | undefined
): string {
  const raw = normalizeInput(input)
  if (raw.length === 0) return ''

  const stripped = stripMarkupAndEntities(raw)
  const collapsed = stripped.replace(/\s+/g, ' ').trim()
  return truncate(collapsed, MAX_PLAIN_TEXT_LENGTH)
}

function normalizeInput(input: string | readonly ReleaseNoteInfo[] | null | undefined): string {
  if (typeof input === 'string') return input
  if (isReleaseNoteArray(input)) {
    return input
      .map((entry) => (entry.note !== null ? `${entry.version}\n${entry.note}` : ''))
      .filter((s) => s.length > 0)
      .join('\n\n')
  }
  return ''
}

function isReleaseNoteArray(value: unknown): value is readonly ReleaseNoteInfo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry): entry is ReleaseNoteInfo =>
        typeof entry === 'object' &&
        entry !== null &&
        'version' in entry &&
        typeof (entry as { version: unknown }).version === 'string' &&
        'note' in entry &&
        (typeof (entry as { note: unknown }).note === 'string' ||
          (entry as { note: unknown }).note === null)
    )
  )
}

function stripMarkupAndEntities(raw: string): string {
  // Order matters: drop scripts/styles whole (incl. payload) before generic tags.
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images: keep alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links: keep label only
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1') // inline + fenced code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX headings
    .replace(/^\s*[-*+]\s+/gm, '') // bullet lists
    .replace(/^\s*\d+\.\s+/gm, '') // ordered lists
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
}

function decodeEntity(match: string, name: string): string {
  if (name.startsWith('#x') || name.startsWith('#X')) {
    const code = Number.parseInt(name.slice(2), 16)
    return Number.isFinite(code) ? safeFromCharCode(code) : match
  }
  if (name.startsWith('#')) {
    const code = Number.parseInt(name.slice(1), 10)
    return Number.isFinite(code) ? safeFromCharCode(code) : match
  }
  const replacement = HTML_ENTITY_MAP[name.toLowerCase()]
  return replacement ?? match
}

function safeFromCharCode(code: number): string {
  // Skip control characters except tab/newline/CR — keeps output printable.
  if (code === 0x09 || code === 0x0a || code === 0x0d) return String.fromCodePoint(code)
  if (code < 0x20 || code === 0x7f) return ' '
  return String.fromCodePoint(code)
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const cut = Math.max(0, maxLength - TRUNCATION_SUFFIX.length)
  return value.slice(0, cut) + TRUNCATION_SUFFIX
}
