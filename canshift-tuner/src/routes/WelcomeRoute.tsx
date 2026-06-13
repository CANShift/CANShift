import type { CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { WelcomeScreen } from '../components/Shell/WelcomeScreen'
import { useConnectionStore } from '../stores/connection.store'

const SUPPORT_EMAIL = 'support@canshift.tmbk.ch'

const isWebSerialAvailable = (): boolean => {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

const buildSupportMailto = (lastError: string | null): string => {
  const subject = encodeURIComponent('CANShift Tuner — issue report')
  const lines = [
    'Hi,',
    '',
    "I'm running into an issue with CANShift Tuner. Here are the details:",
    '',
    `- Browser: ${navigator.userAgent}`,
    `- Status when reporting: ${lastError ?? '—'}`,
    `- Tuner version: ${typeof __TUNER_VERSION__ !== 'undefined' ? __TUNER_VERSION__ : 'unknown'}`,
    '',
    'What happened:',
    '',
    '',
    'What I expected:',
    '',
    '',
    'Thanks!',
  ]
  const body = encodeURIComponent(lines.join('\n'))
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
}

export default function WelcomeRoute() {
  const status = useConnectionStore((s) => s.status)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)

  if (status === 'connected') {
    return <Navigate to="/dashboard" replace />
  }

  const busy = status === 'connecting' || status === 'reconnecting'
  const supported = isWebSerialAvailable()

  return (
    <WelcomeScreen
      supported={supported}
      busy={busy}
      reconnecting={status === 'reconnecting'}
      lastError={lastError}
      onConnect={() => {
        void connect()
      }}
      footerLinks={
        <>
          <Link to="/about" style={linkStyle}>
            About
          </Link>
          <span style={dotSeparatorStyle}>·</span>
          <a
            href="https://docs.canshift.tmbk.ch/user-guide/install/boot-issues/"
            target="_blank"
            rel="noreferrer"
            style={linkStyle}
          >
            Troubleshooting
          </a>
          <span style={dotSeparatorStyle}>·</span>
          <a href={buildSupportMailto(lastError)} style={linkStyle}>
            Report a problem
          </a>
        </>
      }
    />
  )
}

const linkStyle: CSSProperties = {
  color: 'hsl(var(--text-dim))',
  fontSize: 12,
  textDecoration: 'none',
}

const dotSeparatorStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  fontSize: 12,
}
