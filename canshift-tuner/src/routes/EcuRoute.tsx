import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { ECU_PROFILES, parseRealDashXML } from '@tmbk/canshift-core'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore } from '../stores/log.store'
import { BuiltInProfilePicker } from '../components/ecu/BuiltInProfilePicker'
import { RealDashImportZone } from '../components/ecu/RealDashImportZone'
import { SignalPreviewTable } from '../components/ecu/SignalPreviewTable'
import { ApplyConfirmDialog } from '../components/ecu/ApplyConfirmDialog'
import { Button } from '../components/ui/button'

type Source =
  | { kind: 'builtin'; profileId: string }
  | { kind: 'import'; fileName: string; signals: SignalDef[]; warnings: string[] }

export default function EcuRoute() {
  const activeProfileKey = useSignalStore((s) => s.selectedProfileKey)
  const currentSignalCount = useSignalStore((s) => s.signals.length)
  const applyProfile = useSignalStore((s) => s.applyProfile)
  const log = useLogStore((s) => s.push)

  const [source, setSource] = useState<Source>({
    kind: 'builtin',
    profileId: ECU_PROFILES[0]?.id ?? '',
  })
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const previewSignals = useMemo<SignalDef[]>(() => {
    if (source.kind === 'builtin') {
      return ECU_PROFILES.find((p) => p.id === source.profileId)?.signals ?? []
    }
    return source.signals
  }, [source])

  const previewWarnings = source.kind === 'import' ? source.warnings : []
  const targetName = useMemo(() => {
    if (source.kind === 'builtin') {
      return ECU_PROFILES.find((p) => p.id === source.profileId)?.name ?? source.profileId
    }
    return source.fileName
  }, [source])

  const selectedKey =
    source.kind === 'builtin' ? `builtin:${source.profileId}` : `import:${source.fileName}`

  const canApply = previewSignals.length > 0

  const onPickProfile = (profileId: string) => {
    setImportError(null)
    setSource({ kind: 'builtin', profileId })
  }

  const onImportLoad = (fileName: string, xml: string) => {
    setImportError(null)
    const result = parseRealDashXML(xml)
    if (result.signals.length === 0) {
      const reason = result.warnings[0] ?? 'no signals found'
      setImportError(`Import failed — ${reason}`)
      log('error', `RealDash import "${fileName}" failed: ${reason}`)
      return
    }
    setSource({
      kind: 'import',
      fileName,
      signals: result.signals,
      warnings: result.warnings,
    })
    log('info', `RealDash import "${fileName}" parsed: ${String(result.signals.length)} signals`)
  }

  const onImportClear = () => {
    setImportError(null)
    setSource({ kind: 'builtin', profileId: ECU_PROFILES[0]?.id ?? '' })
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
            Replace the active signal map with a built-in profile or a RealDash XML import.
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
          <SectionHeader title="Built-in profiles" />
          <BuiltInProfilePicker
            profiles={ECU_PROFILES}
            selectedKey={selectedKey}
            activeProfileKey={activeProfileKey}
            onSelect={onPickProfile}
          />
          <SectionHeader title="RealDash XML" />
          <RealDashImportZone
            loadedFileName={source.kind === 'import' ? source.fileName : null}
            onFileLoad={onImportLoad}
            onError={setImportError}
            onClear={onImportClear}
          />
          {importError && <div style={importErrorStyle}>{importError}</div>}
        </section>

        <section style={rightColumnStyle}>
          <SectionHeader title={`Preview — ${targetName || 'no selection'}`} />
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

function SectionHeader({ title }: { title: string }) {
  return <div style={sectionHeaderStyle}>{title}</div>
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
  gridTemplateColumns: 'minmax(280px, 360px) 1fr',
  gap: 0,
  minHeight: 0,
}

const leftColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 20px',
  borderRight: '1px solid hsl(var(--border))',
  overflowY: 'auto',
  minHeight: 0,
}

const rightColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 24px',
  minHeight: 0,
}

const sectionHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const importErrorStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--destructive))',
  padding: '8px 10px',
  background: 'hsl(var(--destructive) / 0.1)',
  border: '1px solid hsl(var(--destructive))',
  borderRadius: 6,
}
