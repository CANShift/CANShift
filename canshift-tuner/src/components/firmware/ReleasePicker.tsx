import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import { Button } from '@/components/ui/button'
import { useFirmwareReleases } from '../../hooks/useFirmwareReleases'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { useLogStore } from '../../stores/log.store'
import { downloadFirmwareAsset } from '../../lib/firmware/download'
import { formatBytes } from '../../lib/firmware/local-firmware'
import { findMergedAsset } from '../../lib/firmware/releases'

type Channel = 'stable' | 'prerelease'

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'stable', label: 'Stable' },
  { value: 'prerelease', label: 'Pre-release' },
]

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 10)
}

const filterByChannel = (releases: ReleaseInfo[], channel: Channel): ReleaseInfo[] =>
  channel === 'stable' ? releases.filter((r) => !r.prerelease) : releases

export const ReleasePicker = () => {
  const { state, refresh } = useFirmwareReleases()
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const setReleaseFirmware = useFirmwareSelectionStore((s) => s.setReleaseFirmware)
  const log = useLogStore((s) => s.push)
  const [channel, setChannel] = useState<Channel>('prerelease')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const filtered = useMemo(
    () => (state.kind === 'ok' ? filterByChannel(state.releases, channel) : []),
    [state, channel]
  )

  const selectedTag = selection.kind === 'release' ? selection.release.tag : null

  const handlePick = (release: ReleaseInfo) => {
    const asset = findMergedAsset(release)
    if (!asset) {
      setDownloadError(`${release.tag} has no -merged.bin asset.`)
      log('warn', `Release ${release.tag} skipped — no merged.bin in assets`)
      return
    }
    setDownloading(release.tag)
    setProgress(0)
    setDownloadError(null)
    log('info', `Downloading ${asset.name} (${formatBytes(asset.sizeBytes)})`)
    void downloadFirmwareAsset(asset, (loaded, total) => {
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
        setDownloading(null)
        setProgress(0)
      })
  }

  return (
    <div style={wrapperStyle}>
      <div style={channelRowStyle}>
        {CHANNEL_OPTIONS.map((opt) => {
          const active = channel === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setChannel(opt.value)
              }}
              style={channelButtonStyle(active)}
            >
              {opt.label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <Button type="button" variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {state.kind === 'loading' && <p style={hintStyle}>Loading releases from GitHub…</p>}
      {state.kind === 'error' && (
        <div style={errorCardStyle}>
          <span style={errorLabelStyle}>Fetch failed</span>
          <span>{state.message}</span>
        </div>
      )}

      {state.kind === 'ok' && filtered.length === 0 && (
        <p style={hintStyle}>
          No {channel === 'stable' ? 'stable' : 'pre-release'} builds available yet.
        </p>
      )}

      {state.kind === 'ok' && filtered.length > 0 && (
        <ul style={listStyle}>
          {filtered.map((release) => {
            const merged = findMergedAsset(release)
            const isSelected = release.tag === selectedTag
            const isBusy = downloading === release.tag
            return (
              <li key={release.tag} style={rowStyle(isSelected)}>
                <div style={rowMetaStyle}>
                  <span style={tagStyle}>{release.tag}</span>
                  <span style={dateStyle}>{formatDate(release.publishedAt)}</span>
                  {release.prerelease && <span style={preReleaseBadgeStyle}>pre-release</span>}
                  {merged && <span style={sizeStyle}>{formatBytes(merged.sizeBytes)}</span>}
                </div>
                <Button
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  disabled={isBusy || merged === null}
                  onClick={() => {
                    handlePick(release)
                  }}
                >
                  {isBusy
                    ? `Downloading… ${(progress * 100).toFixed(0)}%`
                    : isSelected
                      ? 'Selected'
                      : merged === null
                        ? 'No build'
                        : 'Use this'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {downloadError && (
        <div style={errorCardStyle}>
          <span style={errorLabelStyle}>Download failed</span>
          <span>{downloadError}</span>
        </div>
      )}
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const channelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const channelButtonStyle = (active: boolean): CSSProperties => ({
  padding: '4px 12px',
  fontSize: 11,
  fontFamily: 'inherit',
  borderRadius: 999,
  border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  background: active ? 'hsl(var(--primary) / 0.15)' : 'transparent',
  color: active ? 'hsl(var(--primary))' : 'hsl(var(--text-dim))',
  cursor: 'pointer',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const rowStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  background: selected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--bg-inset))',
})

const rowMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flex: 1,
}

const tagStyle: CSSProperties = {
  fontFamily: 'monospace',
  color: 'hsl(var(--text))',
  fontSize: 13,
}

const dateStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
}

const sizeStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  fontFamily: 'monospace',
}

const preReleaseBadgeStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'hsl(var(--accent))',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid hsl(var(--accent) / 0.5)',
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  margin: 0,
}

const errorCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid hsl(var(--destructive))',
  background: 'hsl(var(--destructive) / 0.12)',
  fontSize: 12,
  color: 'hsl(var(--text))',
}

const errorLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'hsl(var(--destructive))',
}
