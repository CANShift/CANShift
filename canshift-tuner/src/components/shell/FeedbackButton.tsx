import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { captureFeedback, isPostHogReady } from '../../lib/posthog'

const STORAGE_KEY = 'tuner.feedback.dismissed-hint'

type Status = 'idle' | 'sending' | 'sent'

const FeedbackButton = () => {
  const [ready, setReady] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const location = useLocation()

  useEffect(() => {
    if (!isPostHogReady()) return
    setReady(true)
    const dismissed = localStorage.getItem(STORAGE_KEY) === '1'
    setShowHint(!dismissed)
  }, [])

  if (!ready) return null

  const dismissHint = () => {
    setShowHint(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  const openDialog = () => {
    dismissHint()
    setOpen(true)
    setStatus('idle')
  }

  const closeDialog = () => {
    setOpen(false)
    setMessage('')
    setEmail('')
    setStatus('idle')
  }

  const submit = () => {
    const trimmed = message.trim()
    if (trimmed.length === 0) return
    setStatus('sending')
    const trimmedEmail = email.trim()
    captureFeedback({
      message: trimmed,
      route: location.pathname,
      tunerVersion: __TUNER_VERSION__,
      ...(trimmedEmail.length > 0 ? { email: trimmedEmail } : {}),
    })
    setStatus('sent')
    setTimeout(closeDialog, 1500)
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Send feedback"
          style={{
            background: '#1A1A1A',
            color: '#CCCCCC',
            border: '1px solid #2F2F2F',
            borderRadius: 8,
            padding: 14,
            width: 320,
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>Send feedback</div>
          {status === 'sent' ? (
            <div style={{ fontSize: 12, color: '#88CC88', padding: '8px 0' }}>
              Thanks — your feedback was sent.
            </div>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                }}
                placeholder="Describe the bug or your suggestion…"
                rows={4}
                autoFocus
                style={{
                  background: '#111111',
                  border: '1px solid #333333',
                  borderRadius: 4,
                  color: '#CCCCCC',
                  fontSize: 12,
                  padding: 8,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                }}
                placeholder="Email (optional, for follow-up)"
                style={{
                  background: '#111111',
                  border: '1px solid #333333',
                  borderRadius: 4,
                  color: '#CCCCCC',
                  fontSize: 12,
                  padding: '6px 8px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={status === 'sending'}
                  style={{
                    background: 'transparent',
                    border: '1px solid #333333',
                    borderRadius: 4,
                    color: '#AAAAAA',
                    fontSize: 12,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={status === 'sending' || message.trim().length === 0}
                  style={{
                    background: message.trim().length === 0 ? '#552222' : '#FF4444',
                    border: 'none',
                    borderRadius: 4,
                    color: '#FFFFFF',
                    fontSize: 12,
                    padding: '5px 12px',
                    cursor: message.trim().length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {status === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {!open && showHint && (
        <div
          role="status"
          style={{
            background: '#1A1A1A',
            color: '#CCCCCC',
            border: '1px solid #2F2F2F',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            lineHeight: 1.4,
            maxWidth: 240,
            pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          Got a bug or a suggestion? Click the bubble.
          <button
            type="button"
            onClick={dismissHint}
            style={{
              marginLeft: 8,
              background: 'transparent',
              border: 'none',
              color: '#777777',
              cursor: 'pointer',
              fontSize: 12,
            }}
            aria-label="Dismiss hint"
          >
            ✕
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={openDialog}
        aria-label="Send feedback"
        title="Send feedback"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#FF4444',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default FeedbackButton
