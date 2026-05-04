// ErrorBoundary.tsx — Catches unhandled render errors and shows a recovery UI.
// Wrap any route or sub-tree that should not bring down the whole renderer.

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Optional custom fallback — overrides the built-in error panel. */
  fallback?: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to the renderer console so DevTools captures it.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    if (this.props.fallback !== undefined) return this.props.fallback

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          height: '100%',
          background: '#111111',
          fontFamily: 'system-ui, sans-serif',
          padding: 32,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: '#1A1A1A',
            border: '1px solid #3A1A1A',
            borderRadius: 6,
            padding: '24px 28px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#CC3333',
              marginBottom: 8,
            }}
          >
            Render error
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#FF4444',
              fontWeight: 600,
              marginBottom: 16,
              wordBreak: 'break-word',
            }}
          >
            {error.message}
          </div>
          {error.stack && (
            <pre
              style={{
                fontSize: 10,
                color: '#664444',
                background: '#0E0E0E',
                border: '1px solid #2A1A1A',
                borderRadius: 3,
                padding: '8px 10px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginBottom: 20,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {error.stack}
            </pre>
          )}
          <button
            onClick={() => {
              window.location.reload()
            }}
            style={{
              padding: '6px 18px',
              fontSize: 12,
              fontWeight: 600,
              background: '#2A1A1A',
              border: '1px solid #AA3333',
              borderRadius: 4,
              color: '#FF5555',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
