import type { ChangeEvent, CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogStore } from '../../stores/log.store'
import { useFirmwareSelectionStore } from '../../stores/firmware-selection.store'
import { LocalFirmwareError, readFirmwareFile } from '../../lib/firmware/local-firmware'
import { formatBytes } from '../../lib/format'

const SHA_PREFIX_CHARS = 12

export const LocalFirmwarePicker = () => {
  const selection = useFirmwareSelectionStore((s) => s.selection)
  const setLocalFirmware = useFirmwareSelectionStore((s) => s.setLocalFirmware)
  const clear = useFirmwareSelectionStore((s) => s.clear)
  const log = useLogStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    void readFirmwareFile(file)
      .then((firmware) => {
        setLocalFirmware(firmware)
        log(
          'info',
          `Selected local firmware ${firmware.name} (${formatBytes(firmware.size)}, sha256 ${firmware.sha256.slice(0, SHA_PREFIX_CHARS)}…)`
        )
      })
      .catch((err: unknown) => {
        const message =
          err instanceof LocalFirmwareError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err)
        setError(message)
        log('error', `Local firmware read failed: ${message}`)
      })
      .finally(() => {
        event.target.value = ''
      })
  }

  const handleClear = () => {
    clear()
    setError(null)
    log('info', 'Cleared local firmware selection')
  }

  return (
    <div style={wrapperStyle}>
      <Input
        ref={inputRef}
        type="file"
        accept=".bin,application/octet-stream"
        onChange={handleChange}
      />
      {selection.kind === 'local' && (
        <SelectionCard
          name={selection.firmware.name}
          size={selection.firmware.size}
          sha256={selection.firmware.sha256}
          onClear={handleClear}
        />
      )}
      {error && <ErrorCard message={error} />}
    </div>
  )
}

interface SelectionCardProps {
  name: string
  size: number
  sha256: string
  onClear: () => void
}

const SelectionCard = ({ name, size, sha256, onClear }: SelectionCardProps) => (
  <dl style={cardStyle}>
    <dt style={labelStyle}>File</dt>
    <dd style={valueStyle}>{name}</dd>
    <dt style={labelStyle}>Size</dt>
    <dd style={valueStyle}>{formatBytes(size)}</dd>
    <dt style={labelStyle}>SHA-256</dt>
    <dd style={valueStyle}>{sha256.slice(0, SHA_PREFIX_CHARS)}…</dd>
    <dt style={actionsLabelStyle} />
    <dd style={actionsValueStyle}>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </dd>
  </dl>
)

interface ErrorCardProps {
  message: string
}

const ErrorCard = ({ message }: ErrorCardProps) => (
  <div style={errorCardStyle}>
    <span style={errorLabelStyle}>Read failed</span>
    <span>{message}</span>
  </div>
)

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 12,
  rowGap: 4,
  margin: 0,
  padding: '10px 12px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--bg-inset))',
  fontSize: 12,
  alignItems: 'center',
}

const labelStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: 10,
}

const valueStyle: CSSProperties = {
  margin: 0,
  color: 'hsl(var(--text))',
  fontFamily: 'monospace',
}

const actionsLabelStyle: CSSProperties = {
  ...labelStyle,
  gridColumn: 1,
}

const actionsValueStyle: CSSProperties = {
  margin: 0,
}

const errorCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
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
