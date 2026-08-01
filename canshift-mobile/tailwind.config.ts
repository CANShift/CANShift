import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'
import { Colors, Fonts, Radius } from './src/theme'

// nativewind/preset ships an empty .d.ts, so TS treats it as "not a module".
// Use require() and cast to Config — the runtime export is a valid preset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewindPreset = require('nativewind/preset') as Config

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [nativewindPreset],
  theme: {
    extend: {
      fontFamily: {
        ui: [Fonts.ui],
        'ui-semibold': [Fonts.uiSemiBold],
        'ui-extrabold': [Fonts.uiExtraBold],
      },
      colors: {
        // SoT colors — all 19 keys from DARK_TOKENS.colors
        bg: Colors.bg,
        surface: Colors.surface,
        'surface-2': Colors.surface2,
        border: Colors.border,
        primary: Colors.primary,
        'primary-foreground': Colors.primaryForeground,
        secondary: Colors.secondary,
        'secondary-foreground': Colors.secondaryForeground,
        accent: Colors.accent,
        'accent-foreground': Colors.accentForeground,
        destructive: Colors.destructive,
        'destructive-foreground': Colors.destructiveForeground,
        text: Colors.text,
        'text-dim': Colors.textDim,
        'text-muted': Colors.textMuted,
        success: Colors.success,
        warning: Colors.warning,
        danger: Colors.danger,
        ring: Colors.ring,
      },
      borderRadius: {
        sm: `${Radius.sm}px`,
        md: `${Radius.md}px`,
        lg: `${Radius.lg}px`,
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
