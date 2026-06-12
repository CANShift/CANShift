import { useEffect, useState } from 'react'
import { isPostHogReady } from '../../lib/posthog'

const STORAGE_KEY = 'tuner.feedback.dismissed-hint'

const FeedbackButton = () => {
  const [ready, setReady] = useState(false)
  const [showHint, setShowHint] = useState(false)

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
      {showHint && (
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
          Une suggestion, un bug ? Clique sur la bulle.
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
            aria-label="Masquer l'invite"
          >
            ✕
          </button>
        </div>
      )}
      <button
        type="button"
        className="posthog-feedback-trigger"
        aria-label="Envoyer un feedback"
        title="Envoyer un feedback"
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
