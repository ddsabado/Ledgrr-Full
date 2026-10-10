import { createContext, useContext, type ReactNode } from 'react'

import { useTheme, type Theme } from '@/hooks/useTheme'

interface ThemeContextValue {
  theme: Theme
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Runs the `useTheme` hook exactly once at the app root and shares the result
 * via context. A single instance avoids duplicate class-toggle effects fighting
 * over the document root's class list.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return ctx
}
