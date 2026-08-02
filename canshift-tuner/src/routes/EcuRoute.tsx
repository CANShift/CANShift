import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { parseCanXml } from '@tmbk/canshift-core'
import type { SignalDef } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore } from '../stores/log.store'
import { EcuCatalogueList } from '../components/ecu/EcuCatalogueList'
import type { CatalogueItem } from '../components/ecu/EcuCatalogueList'
import { XmlImportZone } from '../components/ecu/XmlImportZone'
import { SignalPreviewTable } from '../components/ecu/SignalPreviewTable'
import { ApplyConfirmDialog } from '../components/ecu/ApplyConfirmDialog'
import { MONO_FONT } from '../lib/typography'

type Source =
  | { kind: 'none' }
  | { kind: 'import'; fileName: string; signals: SignalDef[]; warnings: string[] }
  | {
      kind: 'catalogue'
      itemId: string
      label: string
      vendor: string
      signals: SignalDef[]
      warnings: string[]
    }

const EcuRoute = () => {
  const activeProfileKey = useSignalStore((s) => s.selectedProfileKey)
  const activeSignals = useSignalStore((s) => s.signals)
  const currentSignalCount = activeSignals.length
  const applyProfile = useSignalStore((s) => s.applyProfile)
  const dashboardConfig = useDashboardStore((s) => s.config)
  const log = useLogStore((s) => s.push)

  const [source, setSource] = useState<Source>({ kind: 'none' })
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const previewSignals = useMemo<SignalDef[]>(() => {
    switch (source.kind) {
      case 'none':
        return []
      case 'import':
      case 'catalogue':
        return source.signals
    }
  }, [source])

  const shownSignals = source.kind === 'none' ? activeSignals : previewSignals

  const boundTo = useMemo(() => {
    const map = new Map<string, string>()
    const pages = dashboardConfig?.pages ?? []
    pages.forEach((page, pageIndex) => {
      for (const widget of page.widgets) {
        if (widget.signal.length > 0 && !map.has(widget.signal)) {
          map.set(widget.signal, `Page ${String(pageIndex + 1)} · ${widget.type}`)
        }
      }
    })
    return map
  }, [dashboardConfig])

  const boundCount = useMemo(
    () => shownSignals.filter((s) => boundTo.has(s.name)).length,
    [shownSignals, boundTo]
  )

  const previewWarnings =
    source.kind === 'import' || source.kind === 'catalogue' ? source.warnings : []

  const targetName = useMemo(() => {
    switch (source.kind) {
      case 'none':
        return ''
      case 'import':
        return source.fileName
      case 'catalogue':
        return `${source.vendor} · ${source.label}`
    }
  }, [source])

  const selectedItemId = source.kind === 'catalogue' ? source.itemId : null

  const selectedKey = (() => {
    switch (source.kind) {
      case 'none':
        return ''
      case 'catalogue':
        return `catalogue:${source.itemId}`
      case 'import':
        return `import:${source.fileName}`
    }
  })()

  const canApply = previewSignals.length > 0

  const onSelectItem = async (item: CatalogueItem) => {
    setImportError(null)
    try {
      const res = await fetch(item.path)
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const xml = await res.text()
      const result = parseCanXml(xml)
      if (result.signals.length === 0) {
        const reason = result.warnings[0] ?? 'no signals found'
        setImportError(`Catalogue load failed — ${reason}`)
        log('error', `Catalogue entry "${item.label}" failed: ${reason}`)
        return
      }
      setSource({
        kind: 'catalogue',
        itemId: item.id,
        label: item.label,
        vendor: item.vendor,
        signals: result.signals,
        warnings: result.warnings,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      setImportError(`Catalogue load failed — ${message}`)
      log('error', `Catalogue entry "${item.label}" fetch failed: ${message}`)
    }
  }

  const onImportLoad = (fileName: string, xml: string) => {
    setImportError(null)
    const result = parseCanXml(xml)
    if (result.signals.length === 0) {
      const reason = result.warnings[0] ?? 'no signals found'
      setImportError(`Import failed — ${reason}`)
      log('error', `XML import "${fileName}" failed: ${reason}`)
      return
    }
    setSource({
      kind: 'import',
      fileName,
      signals: result.signals,
      warnings: result.warnings,
    })
  }

  const onImportClear = () => {
    setImportError(null)
    setSource({ kind: 'none' })
  }

  const onConfirmApply = () => {
    setConfirmOpen(false)
    applyProfile(selectedKey, previewSignals)
    log('success', `Applied "${targetName}" — ${String(previewSignals.length)} signals`)
  }

  const summary =
    source.kind === 'none'
      ? `${prettyProfileKey(activeProfileKey)} · ${String(currentSignalCount)} signals · ${String(boundCount)} bound`
      : `preview — ${targetName} · ${String(previewSignals.length)} signals · ${String(boundCount)} bound`

  return (
    <div style={containerStyle}>
      <header style={toolbarStyle}>
        <span style={titleStyle}>ECU profile</span>
        <span style={summaryStyle}>{summary}</span>
        <button
          type="button"
          className="shell-burn-button"
          disabled={!canApply}
          onClick={() => {
            setConfirmOpen(true)
          }}
          style={applyButtonStyle(!canApply)}
        >
          APPLY PROFILE
        </button>
      </header>

      <div style={bodyStyle}>
        <section style={leftColumnStyle}>
          <div style={catalogueWrapperStyle}>
            <EcuCatalogueList
              activeKey={activeProfileKey}
              selectedId={selectedItemId}
              onSelect={onSelectItem}
            />
          </div>
          <div style={importWrapperStyle}>
            <XmlImportZone
              loadedFileName={source.kind === 'import' ? source.fileName : null}
              onFileLoad={onImportLoad}
              onError={setImportError}
              onClear={onImportClear}
            />
            {importError && <div style={importErrorStyle}>{importError}</div>}
          </div>
        </section>

        <section style={rightColumnStyle}>
          <SignalPreviewTable signals={shownSignals} boundTo={boundTo} warnings={previewWarnings} />
        </section>
      </div>

      <ApplyConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        targetName={targetName}
        newSignalCount={previewSignals.length}
        currentSignalCount={currentSignalCount}
        onConfirm={onConfirmApply}
      />
    </div>
  )
}

const prettyProfileKey = (key: string): string => {
  const [, rest = key] = key.split(':')
  return rest.replace(/[-_]/g, ' ')
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--brand-chrome-bg))',
  overflow: 'hidden',
}

const toolbarStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const titleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: 'hsl(var(--brand-text))',
}

const summaryStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
}

const applyButtonStyle = (disabled: boolean): CSSProperties => ({
  marginLeft: 'auto',
  padding: '6px 16px',
  background: disabled ? 'hsl(var(--brand-neutral-300))' : 'hsl(var(--brand-accent))',
  border: 'none',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-ground))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
}

const leftColumnStyle: CSSProperties = {
  width: 250,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: '2px solid var(--brand-divider)',
  minHeight: 0,
  overflow: 'hidden',
}

const rightColumnStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
}

const catalogueWrapperStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const importWrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 18px',
  borderTop: '2px solid var(--brand-divider)',
}

const importErrorStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--brand-accent))',
  padding: '8px 10px',
  border: '1px solid hsl(var(--brand-accent))',
  background: 'color-mix(in srgb, hsl(var(--brand-accent)) 8%, transparent)',
}

export default EcuRoute
