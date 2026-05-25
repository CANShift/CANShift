// BootLoopBanner.tsx — Bottom-docked danger banner shown when
// `useBootLoopDetector` flags a boot loop on the connected device (#498).
//
// Surfaces the looping firmware version, the count of restarts in the window,
// the last log line captured before the most recent boot marker, and two
// actions: copy the captured pre-boot context to the clipboard for issue
// reporting, or dismiss for the rest of the session.

import { useState } from 'react'
import {
  BOOT_LOOP_WINDOW_MS,
  type CapturedLine,
  useBootLoopStore,
} from '../../stores/bootLoop.store'

const COPY_FEEDBACK_MS = 1_500

// Danger-chrome palette — `--destructive` / `--danger` (#FF0000) is too
// saturated for a sustained banner background. Hoisted as MIRROR consts per
// audit S-H-5 (umbrella #1015); the matching ErrorBar palette in batch 1
// uses the same shades and is the obvious promotion target.
const DANGER_BG = '#1A0808' // MIRROR: deep red banner background
const DANGER_BORDER = '#AA2222' // MIRROR: dim red border + copy button bg
const DANGER_TEXT = '#DDAAAA' // MIRROR: red body text (matches ErrorBar ERR_MSG_TEXT)
const DANGER_CODE_TEXT = '#FFCCCC' // MIRROR: brighter pinkish-white for the inline <code>
const DANGER_BTN_BORDER = '#553333' // MIRROR: darker red for dismiss button border (matches ERR_CLEAR_TEXT family)
const DANGER_BTN_TEXT = '#AA7777' // MIRROR: dismiss button label
// `--scrim` is the canonical token since #1097 — 0.6 alpha matches the original rgba.
const BANNER_SHADOW = '0 4px 16px hsl(var(--scrim) / 0.6)'

function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().slice(11, 23)
}

function formatLines(lines: readonly CapturedLine[]): string {
  return lines
    .map((l) => `[${formatTimestamp(l.timestampMs)}][${l.level}][${l.tag}] ${l.message}`)
    .join('\n')
}

export default function BootLoopBanner() {
  const looping = useBootLoopStore((s) => s.looping)
  const lastVersion = useBootLoopStore((s) => s.lastVersion)
  const lastBootContext = useBootLoopStore((s) => s.lastBootContext)
  const bootMarkers = useBootLoopStore((s) => s.bootMarkers)
  const dismissForSession = useBootLoopStore((s) => s.dismissForSession)
  const [copied, setCopied] = useState(false)

  if (!looping) return null

  const restartCount = bootMarkers.length
  const windowSeconds = BOOT_LOOP_WINDOW_MS / 1_000
  const lastLine = lastBootContext.at(-1)

  const handleCopy = (): void => {
    const formatted = formatLines(lastBootContext)
    void navigator.clipboard
      .writeText(formatted)
      .then(() => {
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, COPY_FEEDBACK_MS)
      })
      .catch(() => {
        // Clipboard write can fail under restrictive permissions; we drop
        // silently rather than surface another scary banner on top.
      })
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 32,
        left: 16,
        zIndex: 9996,
        background: DANGER_BG,
        border: `1px solid ${DANGER_BORDER}`,
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: DANGER_TEXT,
        maxWidth: 520,
        boxShadow: BANNER_SHADOW,
      }}
    >
      <span style={{ flex: 1 }}>
        Device appears to be boot-looping
        {lastVersion ? (
          <>
            {' '}
            (<b>v{lastVersion}</b>, {restartCount} restarts in {windowSeconds} s)
          </>
        ) : (
          <>
            {' '}
            ({restartCount} restarts in {windowSeconds} s)
          </>
        )}
        .{' '}
        {lastLine ? (
          <>
            Last log line:{' '}
            <code style={{ color: DANGER_CODE_TEXT }}>
              [{lastLine.tag}] {lastLine.message}
            </code>
            .{' '}
          </>
        ) : null}
        Flash a known-good firmware or check power.
      </span>
      <button
        onClick={handleCopy}
        disabled={lastBootContext.length === 0}
        style={{
          padding: '4px 10px',
          background: DANGER_BORDER,
          border: `1px solid ${DANGER_BORDER}`,
          borderRadius: 3,
          color: 'hsl(var(--text))',
          fontSize: 11,
          cursor: lastBootContext.length === 0 ? 'not-allowed' : 'pointer',
          opacity: lastBootContext.length === 0 ? 0.6 : 1,
        }}
        title="Copy the last 30 log lines before the boot marker"
      >
        {copied ? 'Copied' : 'Copy log'}
      </button>
      <button
        onClick={dismissForSession}
        style={{
          padding: '3px 8px',
          background: 'transparent',
          border: `1px solid ${DANGER_BTN_BORDER}`,
          borderRadius: 3,
          color: DANGER_BTN_TEXT,
          fontSize: 11,
          cursor: 'pointer',
        }}
        title="Hide for this session"
      >
        Dismiss
      </button>
    </div>
  )
}
