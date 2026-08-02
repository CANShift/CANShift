import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import type { FirmwareSelection } from '../../stores/firmware-selection.store'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { useFlashHistoryStore } from '../../stores/flash-history.store'
import { useFlasher } from '../../hooks/useFlasher'
import type { FlasherState } from '../../hooks/useFlasher'
import { useLogStore } from '../../stores/log.store'
import { downloadFirmwareAsset } from '../../lib/firmware/download'
import { findMergedAsset } from '../../lib/firmware/releases'
import { formatBytes } from '../../lib/format'
import { MONO_FONT } from '../../lib/typography'

export interface FlashActionsProps {
  selection: FirmwareSelection
  pickedRelease: ReleaseInfo | null
}

const selectionLabel = (selection: FirmwareSelection): string =>
  selection.kind === 'release'
    ? selection.release.tag
    : selection.kind === 'local'
      ? selection.firmware.name
      : 'firmware'

const useFlashHistoryRecorder = (
  state: FlasherState,
  flashedLabel: { current: string | null }
): void => {
  const record = useFlashHistoryStore((s) => s.record)
  const prevKind = useRef(state.kind)
  useEffect(() => {
    if (prevKind.current !== state.kind) {
      const label = flashedLabel.current ?? 'firmware'
      if (state.kind === 'success') record(label, true)
      if (state.kind === 'error') record(label, false)
      prevKind.current = state.kind
    }
  }, [state, flashedLabel, record])
}

export const FlashActions = ({ selection, pickedRelease }: FlashActionsProps) => {
  const setReleaseFirmware = useFirmwareSelectionStore((s) => s.setReleaseFirmware)
  const log = useLogStore((s) => s.push)
  const { state, canFlash, flash, reset } = useFlasher()
  const flashedLabelRef = useRef<string | null>(null)
  useFlashHistoryRecorder(state, flashedLabelRef)

  const handleFlash = () => {
    flashedLabelRef.current = selectionLabel(selection)
    flash()
  }

  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadedBytes, setLoadedBytes] = useState(0)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const pickedAsset = pickedRelease ? findMergedAsset(pickedRelease) : null
  const pickedIsDownloaded =
    selection.kind === 'release' &&
    pickedRelease !== null &&
    selection.release.tag === pickedRelease.tag
  const needsDownload = pickedRelease !== null && !pickedIsDownloaded

  const handleDownload = () => {
    if (!pickedRelease || !pickedAsset) return
    const release = pickedRelease
    const asset = pickedAsset
    setDownloading(true)
    setProgress(0)
    setLoadedBytes(0)
    setDownloadError(null)
    log('info', `Downloading ${asset.name} (${formatBytes(asset.sizeBytes)})`)
    void downloadFirmwareAsset(asset, (loaded, total) => {
      setLoadedBytes(loaded)
      setProgress(total > 0 ? loaded / total : 0)
    })
      .then((firmware) => {
        setReleaseFirmware(release, firmware)
        log(
          'success',
          `Downloaded ${asset.name} (${formatBytes(firmware.size)}, sha256 ${firmware.sha256.slice(0, 12)}…)`
        )
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setDownloadError(message)
        log('error', `Download failed for ${asset.name}: ${message}`)
      })
      .finally(() => {
        setDownloading(false)
        setProgress(0)
        setLoadedBytes(0)
      })
  }

  const flashing = state.kind === 'flashing'
  const flashPct =
    state.kind === 'flashing' && state.total > 0
      ? Math.min(100, (state.written / state.total) * 100)
      : 0

  const burnLabel = flashing
    ? `FLASHING… ${String(Math.round(flashPct))}%`
    : `BURN ${selectionLabel(selection).toUpperCase()}`

  return (
    <div style={wrapperStyle}>
      <div style={actionsRowStyle}>
        <button
          type="button"
          className="shell-burn-button"
          disabled={!canFlash || flashing}
          onClick={handleFlash}
          style={burnButtonStyle(!canFlash || flashing)}
        >
          {burnLabel}
        </button>
        {needsDownload && (
          <button
            type="button"
            className="shell-link-button"
            disabled={downloading || pickedAsset === null}
            onClick={handleDownload}
            style={secondaryButtonStyle(downloading || pickedAsset === null)}
          >
            {downloading ? 'DOWNLOADING…' : 'DOWNLOAD .BIN'}
          </button>
        )}
        {(state.kind === 'success' || state.kind === 'error') && (
          <button
            type="button"
            className="shell-link-button"
            onClick={reset}
            style={secondaryButtonStyle(false)}
          >
            RESET
          </button>
        )}
        <span style={etaStyle}>≈ 30 s · do not unplug</span>
      </div>

      {downloading && pickedAsset && (
        <div style={progressGroupStyle}>
          <div style={progressTrackStyle}>
            <div style={progressFillStyle(progress * 100)} />
          </div>
          <div style={progressMetaStyle}>
            <span>
              {formatBytes(loadedBytes)} / {formatBytes(pickedAsset.sizeBytes)}
            </span>
            <span>{(progress * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
      {downloadError && <div style={errorCardStyle}>Download failed — {downloadError}</div>}

      {flashing && (
        <div style={progressTrackStyle}>
          <div style={progressFillStyle(flashPct)} />
        </div>
      )}
      {state.kind === 'success' && (
        <div style={successCardStyle}>
          Flash complete. Unplug the dash from USB and plug it back in to boot the new firmware —
          the flasher's automatic reset is unreliable on this board.
        </div>
      )}
      {state.kind === 'error' && (
        <div style={errorCardStyle}>
          Flash failed — {state.message}. Most common cause: BOOT was not held long enough. Press
          and hold BOOT, then retry.
        </div>
      )}

      <ol style={instructionsStyle}>
        <li>Press and hold the BOOT button on the back of the dash — keep it held.</li>
        <li>Start the burn while still holding BOOT.</li>
        <li>Pick the dash's serial port in the browser prompt (USB-SERIAL CH340).</li>
        <li>Release BOOT once the progress bar starts moving; the flash takes ~30 seconds.</li>
      </ol>
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '20px 24px',
}

const actionsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const burnButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '13px 26px',
  background: disabled ? 'hsl(var(--brand-neutral-300))' : 'hsl(var(--brand-accent))',
  border: 'none',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.09em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-ground))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const secondaryButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '13px 20px',
  background: 'none',
  border: '1px solid hsl(var(--brand-neutral-400))',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.07em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-text))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const etaStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const progressGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const progressTrackStyle: CSSProperties = {
  width: '100%',
  height: 6,
  background: 'hsl(var(--brand-neutral-200))',
  overflow: 'hidden',
}

const progressFillStyle = (pct: number): CSSProperties => ({
  width: `${pct.toFixed(1)}%`,
  height: '100%',
  background: 'hsl(var(--brand-accent))',
  transition: 'width 120ms linear',
})

const progressMetaStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-500))',
}

const successCardStyle: CSSProperties = {
  padding: '10px 14px',
  border: '1px solid hsl(var(--success))',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'hsl(var(--brand-text))',
}

const errorCardStyle: CSSProperties = {
  padding: '10px 14px',
  border: '1px solid hsl(var(--brand-accent))',
  background: 'color-mix(in srgb, hsl(var(--brand-accent)) 8%, transparent)',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'hsl(var(--brand-text))',
}

const instructionsStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  lineHeight: 1.45,
  color: 'hsl(var(--brand-neutral-700))',
}
