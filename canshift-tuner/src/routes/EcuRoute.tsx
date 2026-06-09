import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { parseRealDashXML } from '@tmbk/canshift-core'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore } from '../stores/log.store'
import { EcuCatalogueList } from '../components/ecu/EcuCatalogueList'
import type { CatalogueItem } from '../components/ecu/EcuCatalogueList'
import { XmlImportZone } from '../components/ecu/XmlImportZone'
import { SignalPreviewTable } from '../components/ecu/SignalPreviewTable'
import { ApplyConfirmDialog } from '../components/ecu/ApplyConfirmDialog'
import { Button } from '../components/ui/button'

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

export default function EcuRoute() {
  const activeProfileKey = useSignalStore((s) => s.selectedProfileKey)
  const currentSignalCount = useSignalStore((s) => s.signals.length)
  const applyProfile = useSignalStore((s) => s.applyProfile)
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
      const result = parseRealDashXML(xml)
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
    const result = parseRealDashXML(xml)
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

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>ECU Profile</div>
          <div style={subtitleStyle}>
            Replace the active signal map with a catalogue entry or your own XML file.
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={!canApply}
          onClick={() => {
            setConfirmOpen(true)
          }}
        >
          Apply
        </Button>
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
          <XmlImportZone
            loadedFileName={source.kind === 'import' ? source.fileName : null}
            onFileLoad={onImportLoad}
            onError={setImportError}
            onClear={onImportClear}
          />
          {importError && <div style={importErrorStyle}>{importError}</div>}
        </section>

        <section style={rightColumnStyle}>
          <div style={previewHeaderStyle}>Preview — {targetName || 'no selection'}</div>
          <SignalPreviewTable signals={previewSignals} warnings={previewWarnings} />
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

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  padding: '20px 28px 16px',
  borderBottom: '1px solid hsl(var(--border))',
}

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.01em',
}

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  marginTop: 4,
  maxWidth: 540,
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(300px, 380px) 1fr',
  gap: 0,
  minHeight: 0,
}

const leftColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 20px',
  borderRight: '1px solid hsl(var(--border))',
  minHeight: 0,
}

const rightColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 24px',
  minHeight: 0,
}

const previewHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const catalogueWrapperStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const importErrorStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--destructive))',
  padding: '8px 10px',
  background: 'hsl(var(--destructive) / 0.1)',
  border: '1px solid hsl(var(--destructive))',
  borderRadius: 6,
}
