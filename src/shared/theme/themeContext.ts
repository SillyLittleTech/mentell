import { createContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

