import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        paper: ['ui-serif', 'Georgia', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        paper: '0 14px 40px rgba(0,0,0,0.12)',
        insetSoft: 'inset 0 2px 6px rgba(0,0,0,0.18)',
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
} satisfies Config

