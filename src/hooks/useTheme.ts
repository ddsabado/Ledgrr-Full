import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'high-contrast' | 'semi-light'

/** Wrap-around cycle order: dark → semi-light → light → high-contrast → dark. */
export const themeOrder: Theme[] = ['dark', 'semi-light', 'light', 'high-contrast']

const THEME_CLASSES = ['dark', 'high-contrast', 'semi-light'] as const
const STORAGE_KEY = 'theme'

/**
 * Resolve the initial theme from a stored value. Returns the stored value when
 * it is one of the four defined modes; otherwise defaults to `dark` (also when
 * the value is missing). (R1.5, R1.6)
 */
export function initialTheme(stored: string | null): Theme {
  if (stored && themeOrder.includes(stored as Theme)) return stored as Theme
  return 'dark'
}

/** Advance one step in the wrap-around order. (R1.7) */
export function next(m: Theme): Theme {
  const idx = themeOrder.indexOf(m)
  return themeOrder[(idx + 1) % themeOrder.length]
}

/**
 * Apply a theme to the document root: remove all theme-mode classes, then add
 * the current mode's class unless it is `light` (light is the base :root, no
 * class). (R1.3, R1.4)
 */
export function applyThemeClass(root: HTMLElement, m: Theme): void {
  root.classList.remove(...THEME_CLASSES)
  if (m !== 'light') root.classList.add(m)
}

/** Read the persisted theme, degrading to null if storage is unavailable. */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persist the theme, silently no-op'ing if storage is unavailable. */
function writeStored(m: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, m)
  } catch {
    /* storage unavailable (private mode / disabled) — persistence no-ops */
  }
}

export function useTheme(): { theme: Theme; cycleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => initialTheme(readStored()))

  useEffect(() => {
    applyThemeClass(document.documentElement, theme)
    writeStored(theme)
  }, [theme])

  const cycleTheme = () => setTheme(next)

  return { theme, cycleTheme }
}
