import type { CSSProperties, DragEvent, ChangeEvent } from 'react'
import { useRef, useState } from 'react'

export interface RealDashImportZoneProps {
  loadedFileName: string | null
  onFileLoad: (fileName: string, xml: string) => void
  onError: (message: string) => void
  onClear: () => void
}

const MAX_FILE_BYTES = 2 * 1024 * 1024

export function RealDashImportZone({
  loadedFileName,
  onFileLoad,
  onError,
  onClear,
}: RealDashImportZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      onError(`"${file.name}" is not a .xml file`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      onError(`"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(MAX_FILE_BYTES)} limit`)
      return
    }
    void file.text().then((text) => {
      onFileLoad(file.name, text)
    })
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={zoneStyle(dragging, loadedFileName !== null)}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        onChange={onPick}
        style={{ display: 'none' }}
      />
      {loadedFileName ? (
        <div style={loadedStyle}>
          <div style={loadedNameStyle}>{loadedFileName}</div>
          <button type="button" onClick={onClear} style={clearButtonStyle}>
            Remove
          </button>
        </div>
      ) : (
        <div style={emptyStyle}>
          <div style={iconStyle}>↓</div>
          <div style={emptyTitleStyle}>Drop a RealDash .xml here</div>
          <div style={emptyHintStyle}>or pick a file from disk</div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={pickButtonStyle}
          >
            Choose file…
          </button>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${String(bytes)} B`
}

const zoneStyle = (dragging: boolean, hasFile: boolean): CSSProperties => ({
  border: `1px dashed ${dragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  borderRadius: 8,
  background: dragging
    ? 'hsl(var(--primary) / 0.06)'
    : hasFile
      ? 'hsl(var(--surface))'
      : 'hsl(var(--bg-inset))',
  padding: '24px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 100ms ease, border-color 100ms ease',
})

const emptyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  textAlign: 'center',
}

const iconStyle: CSSProperties = {
  fontSize: 22,
  color: 'hsl(var(--text-muted))',
  lineHeight: 1,
}

const emptyTitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text))',
  fontWeight: 600,
}

const emptyHintStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-muted))',
}

const pickButtonStyle: CSSProperties = {
  marginTop: 8,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.04em',
}

const loadedStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
}

const loadedNameStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

const clearButtonStyle: CSSProperties = {
  background: 'transparent',
  color: 'hsl(var(--text-dim))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
}
