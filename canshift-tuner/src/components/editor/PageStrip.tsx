import { memo } from 'react'
import type { PageConfig, TopBarConfig } from '@tmbk/canshift-core'
import { FIRMWARE_CAPS } from '@tmbk/canshift-core'
import type { CSSProperties } from 'react'
import { PageThumbnail } from '../../routes/PageThumbnail'
import { MONO_FONT } from '../../lib/typography'

const STRIP_HEIGHT = 100

export interface PageStripProps {
  pages: readonly PageConfig[]
  topBar: TopBarConfig
  selectedPageId: string | null
  defaultPageId: string | undefined
  atCap: boolean
  onSelect: (pageId: string) => void
  onAdd: () => void
  onDragStart: (index: number) => void
  onDrop: (toIndex: number) => void
  onSetDefault: (pageId: string) => void
  onRemove: (pageId: string) => void
  onContextMenu: (pageId: string, x: number, y: number) => void
}

const PageStripImpl = ({
  pages,
  topBar,
  selectedPageId,
  defaultPageId,
  atCap,
  onSelect,
  onAdd,
  onDragStart,
  onDrop,
  onSetDefault,
  onRemove,
  onContextMenu,
}: PageStripProps) => {
  const selectedIndex = pages.findIndex((p) => p.id === (selectedPageId ?? pages[0]?.id))
  return (
    <div style={stripStyle}>
      <div style={headerCellStyle}>
        <span style={headerLabelStyle}>PAGES</span>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: atCap ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-600))',
          }}
          title={`Firmware accepts at most ${String(FIRMWARE_CAPS.MAX_PAGES)} pages`}
        >
          {selectedIndex + 1} / {pages.length} · max {FIRMWARE_CAPS.MAX_PAGES}
        </span>
      </div>
      <div style={cellsStyle}>
        {pages.map((page, index) => (
          <PageCell
            key={page.id}
            page={page}
            index={index}
            topBar={topBar}
            isSelected={page.id === (selectedPageId ?? pages[0]?.id)}
            isDefault={page.id === defaultPageId}
            canRemove={pages.length > 1}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onSetDefault={onSetDefault}
            onRemove={onRemove}
            onContextMenu={onContextMenu}
          />
        ))}
        <button
          type="button"
          className="shell-nav-item"
          disabled={atCap}
          onClick={onAdd}
          title={
            atCap
              ? `Firmware accepts at most ${String(FIRMWARE_CAPS.MAX_PAGES)} pages — remove one to add another`
              : 'Add a new page'
          }
          style={addButtonStyle(atCap)}
        >
          + PAGE
        </button>
      </div>
    </div>
  )
}

interface PageCellProps {
  page: PageConfig
  index: number
  topBar: TopBarConfig
  isSelected: boolean
  isDefault: boolean
  canRemove: boolean
  onSelect: (pageId: string) => void
  onDragStart: (index: number) => void
  onDrop: (toIndex: number) => void
  onSetDefault: (pageId: string) => void
  onRemove: (pageId: string) => void
  onContextMenu: (pageId: string, x: number, y: number) => void
}

const PageCell = ({
  page,
  index,
  topBar,
  isSelected,
  isDefault,
  canRemove,
  onSelect,
  onDragStart,
  onDrop,
  onSetDefault,
  onRemove,
  onContextMenu,
}: PageCellProps) => {
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
      style={cellStyle(isSelected, isVisible)}
    >
      {isSelected && <span aria-hidden="true" style={selectedBarStyle} />}
      <div style={cellHeaderStyle}>
        <span style={cellIndexStyle}>{String(index + 1).padStart(2, '0')}</span>
        <span style={cellNameStyle}>Page {index + 1}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSetDefault(page.id)
          }}
          title={isDefault ? 'Default page (shown at boot)' : 'Set as default'}
          style={starButtonStyle(isDefault)}
        >
          {isDefault ? '★' : '☆'}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(page.id)
            }}
            title="Remove page"
            style={removeButtonStyle}
          >
            ×
          </button>
        )}
        <span style={cellCountStyle}>{page.widgets.length}w</span>
      </div>
      <div style={previewFrameStyle}>
        <PageThumbnail page={page} topBar={topBar} />
        {!isVisible && <div style={hiddenOverlayStyle}>hidden</div>}
      </div>
    </div>
  )
}

const stripStyle: CSSProperties = {
  height: STRIP_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'stretch',
  borderBottom: '2px solid var(--brand-divider)',
  background: 'hsl(var(--brand-neutral-100))',
}

const headerCellStyle: CSSProperties = {
  width: 96,
  flexShrink: 0,
  borderRight: '2px solid var(--brand-divider)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

const headerLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const cellsStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'stretch',
  overflowX: 'auto',
}

const cellStyle = (selected: boolean, visible: boolean): CSSProperties => ({
  position: 'relative',
  width: 168,
  flexShrink: 0,
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  padding: '10px 12px 10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  cursor: 'pointer',
  background: selected ? 'hsl(var(--brand-neutral-200))' : 'transparent',
  opacity: visible ? 1 : 0.45,
})

const selectedBarStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
  background: 'hsl(var(--brand-accent))',
}

const cellHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 7,
}

const cellIndexStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const cellNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 12,
  color: 'hsl(var(--brand-text))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
}

const cellCountStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-600))',
}

const starButtonStyle = (isDefault: boolean): CSSProperties => ({
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 11,
  lineHeight: 1,
  cursor: 'pointer',
  color: isDefault ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-500))',
})

const removeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 13,
  lineHeight: 1,
  cursor: 'pointer',
  color: 'hsl(var(--brand-neutral-500))',
}

const previewFrameStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  background: '#0B0A0A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const hiddenOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.55)',
  fontFamily: MONO_FONT,
  fontSize: 10,
  letterSpacing: '0.14em',
  color: 'hsl(var(--brand-neutral-600))',
}

const addButtonStyle = (atCap: boolean): CSSProperties => ({
  width: 92,
  flexShrink: 0,
  background: 'none',
  border: 0,
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.06em',
  color: atCap ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-neutral-700))',
  cursor: atCap ? 'not-allowed' : 'pointer',
})

export const PageStrip = memo(PageStripImpl)
