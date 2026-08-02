import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { useCanScanner } from '../hooks/useCanScanner'
import type { CanFrameStats } from '../hooks/useCanScanner'
import { CanFrameTable } from '../components/can-bus/CanFrameTable'
import { CanScanToolbar } from '../components/can-bus/CanScanToolbar'
import type { SortKey } from '../components/can-bus/SortBar'
import { useDeviceStore } from '../stores/device.store'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore } from '../stores/log.store'

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

  const scannerRef = useRef(scanner)
  scannerRef.current = scanner

  useEffect(() => {
    return () => {
      const s = scannerRef.current
      if (s.status === 'running' || s.status === 'starting') {
        void s.stop()
      }
    }
  }, [])

  const sortedFrames = useMemo(
    () => sortFrames(Array.from(scanner.snapshot.frames.values()), sortKey),
    [scanner.snapshot.frames, sortKey]
  )

  const mappedTo = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of signals) {
      const id = parseHexFrameId(s.canFrameId)
      if (id >= 0 && !map.has(id)) map.set(id, s.name)
    }
    return map
  }, [signals])

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
        sortKey={sortKey}
        onSortChange={setSortKey}
        onStart={() => {
          void scanner.start()
        }}
        onStop={() => {
          void scanner.stop()
        }}
        onReset={scanner.reset}
      />
      <CanFrameTable frames={sortedFrames} nowMs={nowMs} mappedTo={mappedTo} onPromote={promote} />
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
  background: 'hsl(var(--brand-chrome-bg))',
  overflow: 'hidden',
}

export default CanBusRoute
