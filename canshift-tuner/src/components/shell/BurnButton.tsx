import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'

export interface BurnButtonProps {
  disabled?: boolean
  busy?: boolean
  title?: string
  onClick?: () => void
}

export const BurnButton = ({ disabled = false, busy = false, title, onClick }: BurnButtonProps) => {
  const isDisabled = disabled && !busy
  return (
    <Button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      title={title}
      className="h-auto gap-0"
      style={isDisabled ? burnButtonStyleDisabled : burnButtonStyleEnabled}
    >
      {busy ? <BurnSpinner /> : null}
      {busy ? 'Burning…' : 'Burn'}
    </Button>
  )
}

const BurnSpinner = () => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      border: '2px solid hsl(var(--primary-foreground))',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'canshift-tuner-spin 700ms linear infinite',
      marginRight: 6,
      verticalAlign: '-1px',
    }}
  />
)

export interface BurnOutcomePillProps {
  kind: 'success' | 'error'
  message?: string
  onDismiss?: () => void
}

export const BurnOutcomePill = ({ kind, message, onDismiss }: BurnOutcomePillProps) => {
  if (kind === 'success') {
    return (
      <span role="status" style={successPillStyle}>
        Burned ✓
      </span>
    )
  }
  return (
    <span role="alert" title={message} style={errorPillStyle}>
      <span style={errorMessageStyle}>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss burn error"
          onClick={onDismiss}
          style={dismissButtonStyle}
        >
          ✕
        </button>
      ) : null}
    </span>
  )
}

const outcomePillStyleBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 600,
  maxWidth: 320,
}

const successPillStyle: CSSProperties = {
  ...outcomePillStyleBase,
  background: 'hsl(var(--success) / 0.12)',
  border: '1px solid hsl(var(--success))',
  color: 'hsl(var(--success))',
}

const errorPillStyle: CSSProperties = {
  ...outcomePillStyleBase,
  background: 'hsl(var(--destructive) / 0.1)',
  border: '1px solid hsl(var(--destructive))',
  color: 'hsl(var(--destructive))',
}

const errorMessageStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const dismissButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 10,
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
}

const burnButtonStyleBase: CSSProperties = {
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const burnButtonStyleDisabled: CSSProperties = {
  ...burnButtonStyleBase,
  background: 'hsl(var(--surface-2))',
  color: 'hsl(var(--text-dim))',
  border: '1px solid hsl(var(--border))',
  cursor: 'not-allowed',
  opacity: 0.5,
}

const burnButtonStyleEnabled: CSSProperties = {
  ...burnButtonStyleBase,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  border: '1px solid hsl(var(--primary))',
  cursor: 'pointer',
  boxShadow: '0 1px 4px hsl(var(--primary) / 0.3)',
}
