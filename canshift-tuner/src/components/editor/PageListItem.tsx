import { memo } from 'react'
import type { PageConfig, TopBarConfig } from '@tmbk/canshift-core'
import { PageThumbnail } from '../../routes/PageThumbnail'

const DEFAULT_PAGE_GLYPH = '★'
const NON_DEFAULT_PAGE_GLYPH = '☆'

interface PageListItemProps {
  page: PageConfig
  index: number
  isDefault: boolean
  isSelected: boolean
  canRemove: boolean
  topBar: TopBarConfig
  onSelect: (pageId: string) => void
  onDragStart: (index: number) => void
  onDrop: (toIndex: number) => void
  onSetDefault: (pageId: string) => void
  onRemove: (pageId: string) => void
  onContextMenu: (pageId: string, x: number, y: number) => void
}

const PageListItemImpl = ({
  page,
  index,
  isDefault,
  isSelected,
  canRemove,
  topBar,
  onSelect,
  onDragStart,
  onDrop,
  onSetDefault,
  onRemove,
  onContextMenu,
}: PageListItemProps) => {
  const isVisible = page.visible !== false
  return (
    <div
      draggable
      onDragStart={() => {
        onDragStart(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={() => {
        onDrop(index)
      }}
      onClick={() => {
        onSelect(page.id)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(page.id, e.clientX, e.clientY)
      }}
      style={{
        marginBottom: 8,
        cursor: 'pointer',
        opacity: isVisible ? 1 : 0.45,
      }}
    >
      <div
        style={{
          border: `2px solid ${isSelected ? 'hsl(var(--text))' : 'hsl(var(--border))'}`,
          overflow: 'hidden',
          boxShadow: isSelected ? '0 0 0 1px hsl(var(--text) / 0.13)' : 'none',
          transition: 'border-color 0.1s',
          position: 'relative',
        }}
      >
        <PageThumbnail page={page} topBar={topBar} />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSetDefault(page.id)
          }}
          title={isDefault ? 'Default page (shown at boot)' : 'Set as default'}
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDefault ? 'rgba(0, 0, 0, 0.67)' : 'rgba(0, 0, 0, 0.33)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            color: isDefault ? 'hsl(var(--accent))' : 'hsl(var(--text-muted))',
          }}
        >
          {isDefault ? DEFAULT_PAGE_GLYPH : NON_DEFAULT_PAGE_GLYPH}
        </button>
        {canRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(page.id)
            }}
            title="Remove page"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.33)',
              border: 'none',
              padding: 0,
              color: 'hsl(var(--text-dim))',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'hsl(var(--destructive))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'hsl(var(--text-dim))'
            }}
          >
            ×
          </button>
        )}
        {!isVisible && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.33)',
              fontSize: 16,
              color: 'hsl(var(--text-dim))',
            }}
          >
            ◌
          </div>
        )}
      </div>
    </div>
  )
}

export const PageListItem = memo(PageListItemImpl)
