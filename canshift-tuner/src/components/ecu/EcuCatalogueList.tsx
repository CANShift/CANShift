import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { formatBytes } from '../../lib/format'
import { Input } from '../ui/input'
import { TogglePill } from '../ui/toggle-pill'
import { MONO_FONT } from '../../lib/typography'

export interface CatalogueItem {
  id: string
  vendor: string
  file: string
  label: string
  path: string
  sizeBytes: number
}

interface XmlManifest {
  source: string
  license: string
  fetchedAt: string
  entries: CatalogueItem[]
}

export interface EcuCatalogueListProps {
  activeKey: string
  selectedId: string | null
  onSelect: (item: CatalogueItem) => Promise<void> | void
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; manifest: XmlManifest }
  | { kind: 'error'; message: string }

type SortKey = 'vendor' | 'label' | 'size'

const CATALOGUE_URL = '/ecu-catalogue/index.json'

export const EcuCatalogueList = ({ activeKey, selectedId, onSelect }: EcuCatalogueListProps) => {
  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('vendor')

  useEffect(() => {
    setState({ kind: 'loading' })
    let cancelled = false
    void fetch(CATALOGUE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
        return res.json() as Promise<XmlManifest>
      })
      .then((manifest) => {
        if (cancelled) return
        setState({ kind: 'ready', manifest })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'fetch_failed',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return []
    const q = query.trim().toLowerCase()
    const matches = q
      ? state.manifest.entries.filter(
          (e) =>
            e.vendor.toLowerCase().includes(q) ||
            e.label.toLowerCase().includes(q) ||
            e.file.toLowerCase().includes(q)
        )
      : state.manifest.entries.slice()
    matches.sort((a, b) => {
      switch (sortKey) {
        case 'vendor':
          return a.vendor.localeCompare(b.vendor) || a.label.localeCompare(b.label)
        case 'label':
          return a.label.localeCompare(b.label)
        case 'size':
          return b.sizeBytes - a.sizeBytes
      }
    })
    return matches
  }, [state, query, sortKey])

  return (
    <div style={wrapperStyle}>
      <div style={panelHeaderStyle}>PROFILES</div>
      <div style={toolbarStyle}>
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="Search vendor or model"
          className="h-9 text-xs"
          disabled={state.kind !== 'ready'}
        />
        <div style={sortPillsStyle}>
          <TogglePill active={sortKey === 'vendor'} onClick={() => setSortKey('vendor')}>
            Vendor
          </TogglePill>
          <TogglePill active={sortKey === 'label'} onClick={() => setSortKey('label')}>
            Name
          </TogglePill>
          <TogglePill active={sortKey === 'size'} onClick={() => setSortKey('size')}>
            Size
          </TogglePill>
        </div>
      </div>

      {state.kind === 'loading' && <div style={hintStyle}>Loading catalogue…</div>}
      {state.kind === 'error' && (
        <div style={errorStyle}>Failed to load catalogue: {state.message}</div>
      )}

      {state.kind === 'ready' && (
        <>
          <div style={metaStyle}>
            {filtered.length} of {state.manifest.entries.length} entr
            {state.manifest.entries.length === 1 ? 'y' : 'ies'} ·{' '}
            <a
              href={state.manifest.source}
              target="_blank"
              rel="noreferrer"
              style={attributionLinkStyle}
            >
              upstream
            </a>{' '}
            · {state.manifest.license}
          </div>
          <div style={listStyle} role="listbox" aria-label="ECU catalogue">
            {filtered.map((item) => {
              const isSelected = selectedId === item.id
              const isActive = activeKey === `catalogue:${item.id}`
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    void onSelect(item)
                  }}
                  style={itemStyle(isSelected)}
                >
                  <div style={titleRowStyle}>
                    <span style={itemTitleStyle}>{item.label}</span>
                    {isActive && <span style={activeTagStyle}>active</span>}
                  </div>
                  <div style={itemMetaStyle}>
                    <span>{item.vendor}</span>
                    <span style={{ color: 'hsl(var(--text-muted))' }}>
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div style={emptyStyle}>No catalogue entry matches the current search.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: 1,
  minHeight: 0,
}

const panelHeaderStyle: CSSProperties = {
  padding: '12px 18px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '0 18px',
}

const sortPillsStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
}

const metaStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--brand-neutral-500))',
  padding: '0 18px',
}

const attributionLinkStyle: CSSProperties = {
  color: 'hsl(var(--brand-neutral-600))',
  textDecoration: 'underline',
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
}

const itemStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '11px 18px',
  background: selected ? 'hsl(var(--brand-neutral-200))' : 'none',
  border: 'none',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  boxShadow: selected ? 'inset 3px 0 0 hsl(var(--brand-accent))' : undefined,
  textAlign: 'left',
  cursor: 'pointer',
  color: selected ? 'hsl(var(--brand-text))' : 'hsl(var(--brand-neutral-700))',
  fontWeight: selected ? 800 : 400,
  fontFamily: 'inherit',
})

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const itemTitleStyle: CSSProperties = {
  fontSize: 13,
}

const activeTagStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--brand-accent))',
  border: '1px solid hsl(var(--brand-accent))',
  padding: '1px 6px',
}

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  fontWeight: 400,
  color: 'hsl(var(--brand-neutral-500))',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontFamily: MONO_FONT,
}

const hintStyle: CSSProperties = {
  padding: '12px 18px',
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
}

const errorStyle: CSSProperties = {
  margin: '0 18px',
  padding: '10px',
  fontSize: 12,
  color: 'hsl(var(--brand-accent))',
  border: '1px solid hsl(var(--brand-accent))',
  background: 'color-mix(in srgb, hsl(var(--brand-accent)) 8%, transparent)',
}

const emptyStyle: CSSProperties = {
  padding: '24px 18px',
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
  textAlign: 'center',
}
