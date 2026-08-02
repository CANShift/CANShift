import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { UNDO_TOAST_MS, useUndoToastStore } from '../../stores/undo-toast.store'

export const UndoToast = () => {
  const toast = useUndoToastStore((s) => s.toast)
  const undoFromToast = useUndoToastStore((s) => s.undoFromToast)
  const dismiss = useUndoToastStore((s) => s.dismiss)

  useEffect(() => {
    if (!toast) return
    const id = toast.id
    const timer = window.setTimeout(() => {
      dismiss(id)
    }, UNDO_TOAST_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toast, dismiss])

  if (!toast) return null

  return (
    <div role="status" style={toastStyle}>
      <span style={labelStyle}>{toast.label}</span>
      <button
        type="button"
        className="editor-ghost-accent"
        onClick={undoFromToast}
        style={undoButtonStyle}
      >
        UNDO
      </button>
      <button
        type="button"
        onClick={() => {
          dismiss(toast.id)
        }}
        aria-label="Dismiss"
        style={dismissStyle}
      >
        ✕
      </button>
    </div>
  )
}

const toastStyle: CSSProperties = {
  position: 'fixed',
  bottom: 52,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 14px',
  background: 'hsl(var(--brand-chrome-surface))',
  border: '1px solid hsl(var(--brand-neutral-400))',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  zIndex: 200,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--brand-text))',
  whiteSpace: 'nowrap',
}

const undoButtonStyle: CSSProperties = {
  padding: '4px 12px',
  background: 'none',
  border: '1px solid hsl(var(--brand-accent))',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: 'hsl(var(--brand-accent))',
  cursor: 'pointer',
}

const dismissStyle: CSSProperties = {
  padding: 0,
  background: 'none',
  border: 'none',
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-500))',
  cursor: 'pointer',
}
