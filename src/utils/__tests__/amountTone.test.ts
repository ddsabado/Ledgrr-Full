import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { amountToneClass } from '@/utils/amountTone'

const RUNS = { numRuns: 100 }

// Feature: ui-refinements, Property 5: Amount sign selects the semantic tone
// token — success token when n >= 0, danger token when n < 0, and never a fixed
// non-token palette color.
describe('Property 5: amount tone mapping', () => {
  it('maps sign to the success/danger token class, never a palette color', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true }),
        (n) => {
          const cls = amountToneClass(n)
          if (n < 0) {
            expect(cls).toBe('text-danger')
          } else {
            expect(cls).toBe('text-success')
          }
          // Never a fixed palette color.
          expect(cls).not.toMatch(/-(gray|red|green|yellow|emerald|rose)-\d/)
        },
      ),
      RUNS,
    )
  })

  it('treats zero as non-negative (success)', () => {
    expect(amountToneClass(0)).toBe('text-success')
  })
})
