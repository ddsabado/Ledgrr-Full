import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'

import {
  initialTheme,
  next,
  applyThemeClass,
  themeOrder,
  type Theme,
} from '@/hooks/useTheme'

const RUNS = { numRuns: 100 }
const THEME_CLASSES: Theme[] = ['dark', 'high-contrast', 'semi-light']

// Feature: ui-refinements, Property 1: Theme initialization resolves to a valid
// mode — for any stored string, initialTheme returns it when it is one of the
// four modes, and `dark` otherwise (including when absent).
describe('Property 1: theme init / fallback', () => {
  it('returns the stored mode when valid, else dark', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...themeOrder), fc.string(), fc.constant(null)),
        (stored) => {
          const result = initialTheme(stored)
          if (stored !== null && themeOrder.includes(stored as Theme)) {
            expect(result).toBe(stored)
          } else {
            expect(result).toBe('dark')
          }
        },
      ),
      RUNS,
    )
  })
})

// Feature: ui-refinements, Property 2: Theme cycling is a one-step wrap-around —
// next advances one step, and applying it themeOrder.length times returns to
// the original mode.
describe('Property 2: cycle wrap-around', () => {
  it('advances one step and closes the cycle', () => {
    fc.assert(
      fc.property(fc.constantFrom(...themeOrder), (m) => {
        const idx = themeOrder.indexOf(m)
        expect(next(m)).toBe(themeOrder[(idx + 1) % themeOrder.length])

        let cur = m
        for (let i = 0; i < themeOrder.length; i++) cur = next(cur)
        expect(cur).toBe(m)
      }),
      RUNS,
    )
  })
})

// Feature: ui-refinements, Property 3: Exactly the active mode's class is
// present on the root — after applying any sequence of modes, the theme-class
// set equals {last} \ {light}.
describe('Property 3: class application', () => {
  beforeEach(() => {
    document.documentElement.className = ''
  })

  it('leaves exactly the active mode class (none for light)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...themeOrder), { minLength: 1 }),
        (sequence) => {
          const root = document.documentElement
          root.className = ''
          for (const m of sequence) applyThemeClass(root, m)

          const last = sequence[sequence.length - 1]
          const present = THEME_CLASSES.filter((c) => root.classList.contains(c))
          if (last === 'light') {
            expect(present).toEqual([])
          } else {
            expect(present).toEqual([last])
          }
        },
      ),
      RUNS,
    )
  })
})

// Feature: ui-refinements, Property 4: Persist/restore round trip preserves the
// mode — writing a mode to storage and re-initializing from it yields the mode.
describe('Property 4: persist / restore round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('re-initializes to the persisted mode', () => {
    fc.assert(
      fc.property(fc.constantFrom(...themeOrder), (m) => {
        localStorage.setItem('theme', m)
        expect(initialTheme(localStorage.getItem('theme'))).toBe(m)
      }),
      RUNS,
    )
  })
})
