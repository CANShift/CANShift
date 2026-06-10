import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLogStore } from '../stores/log.store'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  scope?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const stack = info.componentStack ?? '(no component stack)'
    useLogStore
      .getState()
      .push('error', `Render crash: ${error.message}\n${stack}`, this.props.scope)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    if (this.props.fallback !== undefined) {
      return this.props.fallback(error, this.reset)
    }

    return <FallbackPanel error={error} onReset={this.reset} />
  }
}

interface FallbackPanelProps {
  error: Error
  onReset: () => void
}

const FallbackPanel = ({ error, onReset }: FallbackPanelProps) => {
  return (
    <div
      role="alert"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
        background: 'hsl(var(--bg))',
        color: 'hsl(var(--text))',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
      <div style={{ color: 'hsl(var(--text-dim))', maxWidth: 480 }}>
        {error.message || 'Unknown render error'}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onReset} style={fallbackButtonStyle}>
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
          style={fallbackButtonStyle}
        >
          Reload
        </button>
      </div>
      <details style={{ marginTop: 12, color: 'hsl(var(--text-dim))', maxWidth: 560 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11 }}>Details</summary>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            textAlign: 'left',
            fontSize: 11,
            background: 'hsl(var(--bg-inset))',
            border: '1px solid hsl(var(--border))',
            padding: 8,
            borderRadius: 4,
            marginTop: 8,
          }}
        >
          {error.stack ?? error.message}
        </pre>
      </details>
    </div>
  )
}

const fallbackButtonStyle = {
  padding: '6px 12px',
  fontSize: 12,
  background: 'hsl(var(--surface))',
  color: 'hsl(var(--text))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  cursor: 'pointer',
} as const
