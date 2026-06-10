import type { CSSProperties } from 'react'
import { FlashSection } from './FlashSection'

export const FirmwareSection = () => (
  <FlashSection step={2} title="Firmware" status="idle">
    <p>Pick which firmware build to write to the dash.</p>
    <ul style={listStyle}>
      <li>
        <strong>Latest stable release</strong> — fetched from the GitHub releases feed, signed,
        size-checked.
      </li>
      <li>
        <strong>Pre-release / beta channel</strong> — opt-in track for in-flight features.
      </li>
      <li>
        <strong>Local .bin file</strong> — for developers building from source.
      </li>
    </ul>
    <p style={hintStyle}>Release picker + file upload land in a follow-up PR.</p>
  </FlashSection>
)

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  fontStyle: 'italic',
  margin: 0,
}
