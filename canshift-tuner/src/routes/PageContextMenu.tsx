import { useEffect, useRef } from 'react'

export interface PageContextMenuProps {
  pageId: string
  x: number
  y: number
  isDefault: boolean
  isVisible: boolean
  canDelete: boolean
  onClose: () => void
  onDuplicate: () => void
  onSetDefault: () => void
  onToggleVisible: () => void
  onDelete: () => void
}

export const PageContextMenu = ({
  x,
  y,
  isDefault,
  isVisible,
  canDelete,
  onClose,
  onDuplicate,
  onSetDefault,
  onToggleVisible,
  onDelete,
}: PageContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('mousedown', close)
    }
  }, [onClose])

  useEffect(() => {
    const btns = () =>
      Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    btns()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const list = btns()
      const idx = list.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
      list[(next + list.length) % list.length]?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const items: {
    label: string
    action: () => void
    danger?: boolean
    disabled?: boolean
  }[] = [
    { label: 'Duplicate', action: onDuplicate },
    {
      label: isDefault ? 'Default ★' : 'Set as default',
      action: onSetDefault,
      disabled: isDefault,
    },
    { label: isVisible ? 'Hide page' : 'Show page', action: onToggleVisible },
    { label: 'Delete', action: onDelete, danger: true, disabled: !canDelete },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'hsl(var(--brand-chrome-surface))',
        border: '1px solid hsl(var(--brand-neutral-300))',
        padding: '3px 0',
        minWidth: 140,
        boxShadow: '0 4px 16px #00000066',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              item.action()
              onClose()
            }
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '5px 12px',
            background: 'none',
            border: 'none',
            fontSize: 12,
            color: item.disabled
              ? 'hsl(var(--brand-neutral-400))'
              : item.danger
                ? 'hsl(var(--status-danger))'
                : 'hsl(var(--brand-neutral-700))',
            cursor: item.disabled ? 'default' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled)
              e.currentTarget.style.background = item.danger
                ? 'color-mix(in srgb, hsl(var(--brand-accent)) 14%, transparent)'
                : 'hsl(var(--brand-neutral-200))'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
