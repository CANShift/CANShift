import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLogStore } from '../../stores/log.store'
import type { ChipInfo } from '../../lib/firmware/esptool'
import { probeChip } from '../../lib/firmware/esptool'

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'ok'; info: ChipInfo }
  | { kind: 'error'; message: string }

const isWebSerialAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'serial' in navigator

export const IdentifyChipButton = () => {
  const log = useLogStore((s) => s.push)
  const [state, setState] = useState<ProbeState>({ kind: 'idle' })

  const handleClick = () => {
    if (!isWebSerialAvailable()) {
      setState({ kind: 'error', message: 'WebSerial unavailable in this browser.' })
      return
    }
    setState({ kind: 'probing' })
    log('info', 'Chip probe requested')
    void runProbe()
      .then((info) => {
        setState({ kind: 'ok', info })
        log('success', `Chip identified: ${info.description} (MAC ${info.mac})`)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setState({ kind: 'error', message })
        log('error', `Chip probe failed: ${message}`)
      })
  }

  return (
    <div style={wrapperStyle}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={state.kind === 'probing'}
      >
        {state.kind === 'probing' ? 'Probing…' : 'Identify chip'}
      </Button>
      {state.kind === 'ok' && <ChipInfoCard info={state.info} />}
      {state.kind === 'error' && <ErrorCard message={state.message} />}
    </div>
  )
}

const runProbe = async (): Promise<ChipInfo> => {
  const port = await navigator.serial.requestPort()
  return probeChip(port)
}

interface ChipInfoCardProps {
  info: ChipInfo
}

const ChipInfoCard = ({ info }: ChipInfoCardProps) => (
  <dl style={infoCardStyle}>
    <dt style={infoLabelStyle}>Chip</dt>
    <dd style={infoValueStyle}>{info.description}</dd>
    <dt style={infoLabelStyle}>MAC</dt>
    <dd style={infoValueStyle}>{info.mac}</dd>
  </dl>
)

interface ErrorCardProps {
  message: string
}

const ErrorCard = ({ message }: ErrorCardProps) => (
  <div style={errorCardStyle}>
    <span style={errorLabelStyle}>Probe failed</span>
    <span style={errorMessageStyle}>{message}</span>
  </div>
)

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 10,
}

const infoCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 12,
  rowGap: 4,
  margin: 0,
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--bg-inset))',
  fontSize: 12,
}

const infoLabelStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: 10,
  alignSelf: 'center',
}

const infoValueStyle: CSSProperties = {
  margin: 0,
  color: 'hsl(var(--text))',
  fontFamily: 'monospace',
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

const errorMessageStyle: CSSProperties = {
  fontSize: 12,
}
