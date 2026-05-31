// PageContextMenu.tsx — Right-click menu over a page-list thumbnail.
// Pure presentation: every action is dispatched through a callback prop so
// EditorRoute keeps the page-list orchestration. Closes on outside click.

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

export function PageContextMenu({
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
}: PageContextMenuProps) {
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

  // ★ matches `DEFAULT_PAGE_GLYPH` in EditorRoute — keep both in sync.
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
        background: '#1A1A1A',
        border: '1px solid #2A2A2A',
        borderRadius: 5,
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
            color: item.disabled ? '#333333' : item.danger ? '#CC4444' : '#CCCCCC',
            cursor: item.disabled ? 'default' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled)
              e.currentTarget.style.background = item.danger ? '#2A1111' : '#252525'
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
