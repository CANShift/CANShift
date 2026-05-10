// ReleaseInfoCard.tsx — Surfaces the current vs latest GitHub release.
//
// Issue #571. Mounts in the device-config (settings) route. Compares
// `app.getVersion()` against the latest release on `tburkhalterr/CANShift`,
// renders the markdown release notes via `SafeMarkdown`, and lists the
// downloadable assets. All outbound clicks go through `<a target="_blank">`
// so the main-process `setWindowOpenHandler` can vet them before handing
// them to `shell.openExternal`.

import { useEffect, useMemo, useState, type JSX } from 'react'
import type { LatestReleaseResult, ReleaseInfo } from '@tmbk/canshift-core'
import { appIpc } from '../../services/ipc.service'
import { useLatestRelease } from '../../hooks/useLatestRelease'
import { SafeMarkdown } from './SafeMarkdown'

const PRE_RELEASE_TOGGLE_KEY = 'canshift.studio.releases.showPrerelease'

type ComparisonKind =
  | { kind: 'unknown' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'behind'; current: string; latest: string }
  | { kind: 'ahead'; current: string; latest: string }
  | { kind: 'on-prerelease'; current: string; latestStable: string | null }

interface SemverParts {
  major: number
  minor: number
  patch: number
}

function parseSemver(input: string): SemverParts | null {
  // Accept optional leading "v" and an optional pre-release/build suffix.
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(input.trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (![major, minor, patch].every((n) => Number.isFinite(n))) return null
  return { major, minor, patch }
}

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

function isPreReleaseTag(version: string): boolean {
  return /[-+]/.test(version)
}

function classify(
  currentRaw: string | null,
  release: ReleaseInfo,
  prerelease: ReleaseInfo | null
): ComparisonKind {
  if (currentRaw === null) return { kind: 'unknown' }
  const current = parseSemver(currentRaw)
  const latestStable = parseSemver(release.version)
  if (!current || !latestStable) return { kind: 'unknown' }

  // A pre-release tag on the running app trumps the stable comparison —
  // users on a beta build want to see "on pre-release", not "up to date".
  if (isPreReleaseTag(currentRaw) || currentRaw === prerelease?.version) {
    return {
      kind: 'on-prerelease',
      current: currentRaw,
      latestStable: release.version,
    }
  }

  const delta = compareSemver(current, latestStable)
  if (delta === 0) return { kind: 'up-to-date', current: currentRaw }
  if (delta < 0) return { kind: 'behind', current: currentRaw, latest: release.version }
  return { kind: 'ahead', current: currentRaw, latest: release.version }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${String(bytes)} B`
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString()
}

function loadPreReleaseToggle(): boolean {
  // While we're pre-1.0 every release is flagged pre-release, so the toggle
  // defaults to `true` per the issue notes. Bumping past v1.0 will flip this
  // default in a follow-up release.
  try {
    const stored = window.localStorage.getItem(PRE_RELEASE_TOGGLE_KEY)
    if (stored === null) return true
    return stored !== 'false'
  } catch {
    return true
  }
}

function savePreReleaseToggle(value: boolean): void {
  try {
    window.localStorage.setItem(PRE_RELEASE_TOGGLE_KEY, value ? 'true' : 'false')
  } catch {
    // localStorage may be unavailable (private mode, denied permission). The
    // toggle still works for the rest of the session — we just don't persist.
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #222222',
  borderRadius: 8,
  padding: '16px 20px',
}

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#AAAAAA',
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const versionStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#FFFFFF',
  fontWeight: 600,
}

const linkStyle: React.CSSProperties = {
  color: '#7788CC',
  textDecoration: 'none',
  fontSize: 11,
}

const buttonStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: 'transparent',
  border: '1px solid #2A2A2A',
  borderRadius: 4,
  color: '#AAAAAA',
  fontSize: 11,
  cursor: 'pointer',
}

const COMPARISON_COPY: Record<ComparisonKind['kind'], { tone: string; label: string }> = {
  unknown: { tone: '#777777', label: 'Version unknown' },
  'up-to-date': { tone: '#3DB86B', label: 'Up to date' },
  behind: { tone: '#CC8844', label: 'Update available' },
  ahead: { tone: '#7788CC', label: 'Ahead of latest stable' },
  'on-prerelease': { tone: '#CC8844', label: 'Running a pre-release build' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReleaseInfoCard(): JSX.Element {
  const { state, isFetching, refresh } = useLatestRelease()
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [showPreRelease, setShowPreRelease] = useState<boolean>(loadPreReleaseToggle)
  const [notesOpen, setNotesOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    appIpc
      .version()
      .then((v) => {
        if (!cancelled) setCurrentVersion(v)
      })
      .catch(() => {
        if (!cancelled) setCurrentVersion(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTogglePreRelease = (next: boolean): void => {
    setShowPreRelease(next)
    savePreReleaseToggle(next)
  }

  const result: LatestReleaseResult | null =
    state.status === 'ready' ? state.result : state.previous

  const displayedRelease = useMemo<ReleaseInfo | null>(() => {
    if (!result) return null
    if (result.ok) {
      if (showPreRelease && result.prerelease) {
        // Pre-release is the latest by date when both exist.
        return result.prerelease
      }
      return result.release
    }
    return result.cached?.release ?? null
  }, [result, showPreRelease])

  const comparison = useMemo(() => {
    if (!displayedRelease) return { kind: 'unknown' as const }
    const referenceRelease = result?.ok
      ? result.release
      : (result?.cached?.release ?? displayedRelease)
    const referencePrerelease = result?.ok
      ? result.prerelease
      : (result?.cached?.prerelease ?? null)
    return classify(currentVersion, referenceRelease, referencePrerelease)
  }, [currentVersion, displayedRelease, result])

  return (
    <div style={cardStyle} data-testid="release-info-card">
      <div style={titleStyle}>Updates &amp; Releases</div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={labelStyle}>Current</div>
          <div style={versionStyle}>{currentVersion !== null ? `v${currentVersion}` : '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={labelStyle}>Latest{displayedRelease?.prerelease ? ' pre-release' : ''}</div>
          <div style={versionStyle}>
            {displayedRelease !== null ? `v${displayedRelease.version}` : '—'}
          </div>
        </div>
      </div>

      <ComparisonBadge comparison={comparison} />

      {state.status === 'loading' && !displayedRelease ? (
        <LoadingBlock />
      ) : result && !result.ok && !displayedRelease ? (
        <ErrorBlock message={result.message} />
      ) : displayedRelease ? (
        <ReleaseBody
          release={displayedRelease}
          notesOpen={notesOpen}
          onToggleNotes={() => {
            setNotesOpen((o) => !o)
          }}
        />
      ) : null}

      <FooterRow
        result={result}
        isFetching={isFetching}
        onRefresh={refresh}
        showPreRelease={showPreRelease}
        onTogglePreRelease={handleTogglePreRelease}
        hasPreRelease={result?.ok ? result.prerelease !== null : false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function comparisonDetail(comparison: ComparisonKind): string | null {
  switch (comparison.kind) {
    case 'behind':
      return `v${comparison.current} → v${comparison.latest}`
    case 'ahead':
      return `Running v${comparison.current} (latest stable: v${comparison.latest})`
    case 'on-prerelease':
      return comparison.latestStable
        ? `Running v${comparison.current} · latest stable v${comparison.latestStable}`
        : `Running v${comparison.current}`
    case 'up-to-date':
      return `v${comparison.current}`
    case 'unknown':
      return null
    default: {
      const exhaustive: never = comparison
      return exhaustive
    }
  }
}

function ComparisonBadge({ comparison }: { comparison: ComparisonKind }): JSX.Element {
  const { tone, label } = COMPARISON_COPY[comparison.kind]
  const detail = comparisonDetail(comparison)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        padding: '8px 12px',
        background: '#0E0E0E',
        border: `1px solid ${tone}33`,
        borderRadius: 6,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: tone,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: tone, fontWeight: 600 }}>{label}</div>
        {detail !== null && (
          <div style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>{detail}</div>
        )}
      </div>
    </div>
  )
}

function LoadingBlock(): JSX.Element {
  return (
    <div
      style={{
        padding: '16px 0',
        fontSize: 11,
        color: '#555555',
        textAlign: 'center',
      }}
    >
      Fetching release info from GitHub…
    </div>
  )
}

function ErrorBlock({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: '#1A0D0D',
        border: '1px solid #552222',
        borderRadius: 5,
        fontSize: 11,
        color: '#CC8888',
        marginBottom: 8,
      }}
    >
      Couldn&apos;t reach GitHub: {message}
    </div>
  )
}

function ReleaseBody({
  release,
  notesOpen,
  onToggleNotes,
}: {
  release: ReleaseInfo
  notesOpen: boolean
  onToggleNotes: () => void
}): JSX.Element {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, color: '#888888' }}>
          Published {formatDate(release.publishedAt)}
        </span>
        {release.prerelease && (
          <span
            style={{
              fontSize: 9,
              color: '#CC8844',
              border: '1px solid #553311',
              borderRadius: 3,
              padding: '1px 5px',
              letterSpacing: '0.05em',
            }}
          >
            PRE-RELEASE
          </span>
        )}
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...linkStyle, marginLeft: 'auto' }}
        >
          Open on GitHub ↗
        </a>
      </div>

      {release.notes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={onToggleNotes}
            style={{
              ...buttonStyle,
              padding: '4px 8px',
              marginBottom: 6,
            }}
          >
            {notesOpen ? 'Hide release notes' : 'Show release notes'}
          </button>
          {notesOpen && (
            <div
              style={{
                background: '#0E0E0E',
                border: '1px solid #1E1E1E',
                borderRadius: 5,
                padding: '10px 12px',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              <SafeMarkdown source={release.notes} className="text-xs" />
            </div>
          )}
        </div>
      )}

      {release.assets.length > 0 && (
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Assets</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {release.assets.map((asset) => (
              <li
                key={asset.downloadUrl}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderTop: '1px solid #1E1E1E',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    color: '#CCCCCC',
                    fontFamily: 'monospace',
                  }}
                  title={asset.name}
                >
                  {asset.name}
                </span>
                <span style={{ fontSize: 10, color: '#666666', flexShrink: 0 }}>
                  {formatBytes(asset.sizeBytes)}
                </span>
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...linkStyle, flexShrink: 0 }}
                >
                  Open ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function FooterRow({
  result,
  isFetching,
  onRefresh,
  showPreRelease,
  onTogglePreRelease,
  hasPreRelease,
}: {
  result: LatestReleaseResult | null
  isFetching: boolean
  onRefresh: () => void
  showPreRelease: boolean
  onTogglePreRelease: (next: boolean) => void
  hasPreRelease: boolean
}): JSX.Element {
  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid #1E1E1E',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#888888' }}
      >
        <input
          type="checkbox"
          checked={showPreRelease}
          onChange={(e) => {
            onTogglePreRelease(e.target.checked)
          }}
          disabled={!hasPreRelease}
        />
        Show pre-release builds
      </label>
      <span style={{ flex: 1 }} />
      {result !== null && (
        <span style={{ fontSize: 10, color: '#555555' }}>
          Last checked: {formatDate(result.fetchedAt)}
        </span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        style={{
          ...buttonStyle,
          opacity: isFetching ? 0.5 : 1,
          cursor: isFetching ? 'default' : 'pointer',
        }}
      >
        {isFetching ? 'Checking…' : 'Check now'}
      </button>
    </div>
  )
}
