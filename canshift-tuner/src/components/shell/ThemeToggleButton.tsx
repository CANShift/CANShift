import type { CSSProperties } from 'react'
import type { ChromeTheme } from '../../stores/theme.store'

export interface ThemeToggleButtonProps {
  theme: ChromeTheme
  onToggle: () => void
}

export const ThemeToggleButton = ({ theme, onToggle }: ThemeToggleButtonProps) => (
  <button
    type="button"
    onClick={onToggle}
    className="shell-theme-toggle"
    title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
    style={toggleStyle}
  >
    {theme === 'dark' ? 'DAY' : 'NIGHT'}
  </button>
)

const toggleStyle: CSSProperties = {
  padding: '0 16px',
  background: 'none',
  border: 'none',
  borderRight: '2px solid var(--brand-divider)',
  color: 'hsl(var(--brand-neutral-600))',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
}
