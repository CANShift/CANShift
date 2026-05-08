import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

// nativewind/preset ships an empty .d.ts, so TS treats it as "not a module".
// Use require() and cast to Config — the runtime export is a valid preset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewindPreset = require('nativewind/preset') as Config

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0D',
        surface: '#111111',
        'surface-2': '#1A1A1A',
        border: '#2A2A2A',
        primary: '#E03030',
        'primary-foreground': '#FFFFFF',
        destructive: '#FF4444',
        'destructive-foreground': '#FFFFFF',
        accent: '#E03030',
        'accent-foreground': '#FFFFFF',
        text: '#CCCCCC',
        'text-dim': '#888888',
        'text-muted': '#555555',
        success: '#55AA55',
        warning: '#FF8800',
        danger: '#FF4444',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
