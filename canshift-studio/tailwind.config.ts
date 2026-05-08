import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        text: 'var(--text)',
        'text-dim': 'var(--text-dim)',
        'text-muted': 'var(--text-muted)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        success: 'var(--success)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
