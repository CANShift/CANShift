import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { useCanScanner } from '../hooks/useCanScanner'
import type { CanFrameStats } from '../hooks/useCanScanner'
import { CanScanToolbar } from '../components/can-bus/CanScanToolbar'
import { CanFrameTable } from '../components/can-bus/CanFrameTable'
import { useDeviceStore } from '../stores/device.store'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore } from '../stores/log.store'

type SortKey = 'id' | 'lastSeen' | 'rate' | 'count'

const NOW_TICK_MS = 250

const CanBusRoute = () => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const signals = useSignalStore((s) => s.signals)
  const setSignals = useSignalStore((s) => s.setSignals)
  const log = useLogStore((s) => s.push)
  const scanner = useCanScanner()
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [nowMs, setNowMs] = useState(() => performance.now())

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(performance.now())
    }, NOW_TICK_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (scanner.status === 'running' || scanner.status === 'starting') {
        void scanner.stop()
      }
    }
  }, [scanner])

  const sortedFrames = useMemo(
    () => sortFrames(Array.from(scanner.snapshot.frames.values()), sortKey),
    [scanner.snapshot.frames, sortKey]
  )

  const promote = useCallback(
    (id: number) => {
      const existing = signals.find((s) => parseHexFrameId(s.canFrameId) === id)
      if (existing) {
        log('warn', `Signal "${existing.name}" already bound to ${formatFrameIdHex(id)}`)
        return
      }
      const draft = buildDraftSignal(id, signals.length)
      setSignals([...signals, draft])
      log('success', `Promoted ${formatFrameIdHex(id)} to draft signal "${draft.name}"`)
    },
    [signals, setSignals, log]
  )

  const canControl = connected && !simulationMode

  return (
    <div style={containerStyle}>
      <CanScanToolbar
        status={scanner.status}
        canControl={canControl}
        totalFrames={scanner.snapshot.totalFrames}
        totalRate={scanner.snapshot.totalRate}
        startedAt={scanner.snapshot.startedAt}
        error={scanner.error}
        onStart={() => {
          void scanner.start()
        }}
        onStop={() => {
          void scanner.stop()
        }}
        onReset={scanner.reset}
      />
      <SortBar sortKey={sortKey} onChange={setSortKey} />
      <CanFrameTable frames={sortedFrames} nowMs={nowMs} onPromote={promote} />
    </div>
  )
}

interface SortBarProps {
  sortKey: SortKey
  onChange: (key: SortKey) => void
}

const SortBar = ({ sortKey, onChange }: SortBarProps) => {
  const options: ReadonlyArray<{ key: SortKey; label: string }> = [
    { key: 'id', label: 'ID' },
    { key: 'lastSeen', label: 'Last seen' },
    { key: 'rate', label: 'Rate' },
    { key: 'count', label: 'Count' },
  ]
  return (
    <div style={sortBarStyle}>
      <span style={sortLabelStyle}>Sort by</span>
      {options.map((o) => {
        const active = o.key === sortKey
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              onChange(o.key)
            }}
            style={sortPillStyle(active)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const sortFrames = (frames: CanFrameStats[], key: SortKey): CanFrameStats[] => {
  const sorted = frames.slice()
  switch (key) {
    case 'id':
      sorted.sort((a, b) => a.id - b.id)
      break
    case 'lastSeen':
      sorted.sort((a, b) => b.lastSeenMs - a.lastSeenMs)
      break
    case 'rate':
      sorted.sort((a, b) => b.rateHz - a.rateHz)
      break
    case 'count':
      sorted.sort((a, b) => b.count - a.count)
      break
  }
  return sorted
}

const formatFrameIdHex = (id: number): string => {
  const extended = id > 0x7ff
  const width = extended ? 8 : 3
  return `0x${id.toString(16).toUpperCase().padStart(width, '0')}`
}

const parseHexFrameId = (hex: string): number => {
  const trimmed = hex.toLowerCase().replace(/^0x/, '')
  const parsed = parseInt(trimmed, 16)
  return Number.isFinite(parsed) ? parsed : -1
}

const buildDraftSignal = (id: number, existingCount: number): SignalDef => {
  return {
    name: `scan_signal_${String(existingCount + 1)}`,
    canFrameId: formatFrameIdHex(id),
    startByte: 0,
    byteLength: 1,
    bigEndian: false,
    signed: false,
    scale: 1,
    offset: 0,
    unit: '',
    min: 0,
    max: 255,
    timeoutMs: 2_000,
  }
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const sortBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
}

const sortLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  marginRight: 4,
}

const sortPillStyle = (active: boolean): CSSProperties => ({
  background: active ? 'hsl(var(--primary) / 0.15)' : 'transparent',
  color: active ? 'hsl(var(--primary))' : 'hsl(var(--text-dim))',
  border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  borderRadius: 999,
  padding: '3px 12px',
  fontSize: 11,
  cursor: 'pointer',
  fontWeight: 600,
  letterSpacing: '0.04em',
})

export default CanBusRoute
