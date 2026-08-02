import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { BuildChooser } from '../components/firmware/BuildChooser'
import { FirmwareSidePanel } from '../components/firmware/FirmwareSidePanel'
import { FlashActions } from '../components/firmware/FlashActions'
import { KeyFigures } from '../components/firmware/KeyFigures'
import { WriteAndPreflight } from '../components/firmware/WriteAndPreflight'
import { useFirmwareReleases } from '../hooks/useFirmwareReleases'
import { useDeviceStore } from '../stores/device.store'
import { useFirmwareSelectionStore } from '../stores/firmware-selection.store'
import { MONO_FONT } from '../lib/typography'

const FirmwareRoute = () => {
  const { state: releasesState, refresh } = useFirmwareReleases()
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const clearSelection = useFirmwareSelectionStore((s) => s.clear)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const installedVersion = useDeviceStore((s) => s.firmwareVersion)
  const [pickedTag, setPickedTag] = useState<string | null>(null)

  const releases = useMemo(
    () => (releasesState.kind === 'ok' ? releasesState.releases : []),
    [releasesState]
  )
  const latestStable = useMemo(() => releases.find((r) => !r.prerelease) ?? null, [releases])
  const effectiveTag =
    selection.kind === 'local'
      ? null
      : (pickedTag ?? (selection.kind === 'release' ? selection.release.tag : null))
  const pickedRelease = useMemo(
    () => releases.find((r) => r.tag === effectiveTag) ?? null,
    [releases, effectiveTag]
  )

  const linked = connected && !simulationMode

  const pickRelease = (tag: string) => {
    if (selection.kind === 'local') clearSelection()
    setPickedTag(tag)
  }

  const localPicked = () => {
    setPickedTag(null)
  }

  return (
    <div style={containerStyle}>
      <header style={toolbarStyle}>
        <span style={titleStyle}>Firmware</span>
        <span style={linkPillStyle}>
          <span style={linkDotStyle(linked)} />
          {linked ? 'tuner link active — released for the flash' : 'no device connected'}
        </span>
        <span style={toolInfoStyle}>esptool-js · WebSerial</span>
      </header>
      <div style={bodyStyle}>
        <div style={mainColumnStyle}>
          <KeyFigures
            installedVersion={installedVersion}
            latestStable={latestStable}
            selection={selection}
          />
          <BuildChooser
            releasesState={releasesState}
            selection={selection}
            pickedTag={effectiveTag}
            installedVersion={installedVersion}
            onPickRelease={pickRelease}
            onLocalPicked={localPicked}
            onRefresh={refresh}
          />
          <WriteAndPreflight selection={selection} />
          <FlashActions selection={selection} pickedRelease={pickedRelease} />
        </div>
        <FirmwareSidePanel
          release={
            pickedRelease ?? (selection.kind === 'release' ? selection.release : latestStable)
          }
        />
      </div>
    </div>
  )
}

export default FirmwareRoute

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

const linkPillStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  border: '1px solid hsl(var(--brand-neutral-400))',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-700))',
}

const linkDotStyle = (linked: boolean): CSSProperties => ({
  width: 7,
  height: 7,
  background: linked ? 'hsl(var(--success))' : 'hsl(var(--brand-neutral-500))',
})

const toolInfoStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
}

const mainColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
}
