import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { formatTransactionDate } from '@/utils/date'

const RUNS = { numRuns: 100 }

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const FORMAT_RE =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \| \d{2}:\d{2} (AM|PM)$/

const pad2 = (n: number) => String(n).padStart(2, '0')

// Feature: ui-refinements, Property 6: Valid transaction dates format to the
// exact pattern in local time — month, day, 12-hour hour, minute and AM/PM
// marker equal the local-timezone parts of the parsed date.
describe('Property 6: valid dates format to the exact local-time pattern', () => {
  it('matches the pattern and reflects the local parts', () => {
    fc.assert(
      fc.property(
        // Build a real local Date, then feed its own local parts as a source
        // string in the sheet's M/D/YYYY H:mm:ss format (parsed as local time).
        fc.date({
          min: new Date(2000, 0, 1, 0, 0, 0),
          max: new Date(2099, 11, 31, 23, 59, 59),
          noInvalidDate: true,
        }),
        (d) => {
          const source = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad2(
            d.getMinutes(),
          )}:00`
          const parsed = new Date(source)
          fc.pre(!Number.isNaN(parsed.getTime()))

          const out = formatTransactionDate(source)
          expect(out).toMatch(FORMAT_RE)

          const expectedH = parsed.getHours() % 12 || 12
          const marker = parsed.getHours() < 12 ? 'AM' : 'PM'
          const expected = `${MONTHS[parsed.getMonth()]} ${pad2(parsed.getDate())} | ${pad2(
            expectedH,
          )}:${pad2(parsed.getMinutes())} ${marker}`
          expect(out).toBe(expected)
        },
      ),
      RUNS,
    )
  })

  it('handles the 12-hour boundaries (midnight → 12 AM, noon → 12 PM)', () => {
    expect(formatTransactionDate('1/5/2026 0:00:00')).toBe('Jan 05 | 12:00 AM')
    expect(formatTransactionDate('1/5/2026 12:00:00')).toBe('Jan 05 | 12:00 PM')
    expect(formatTransactionDate('1/5/2026 13:07:00')).toBe('Jan 05 | 01:07 PM')
  })
})

// Feature: ui-refinements, Property 7: Unparseable or empty dates pass through
// unchanged.
describe('Property 7: unparseable / empty dates pass through unchanged', () => {
  it('returns the original value for empty, whitespace, or non-date strings', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constantFrom(' ', '   ', '\t', '\n'),
          // Non-date strings: reject anything the runtime happens to parse.
          fc.string().filter((s) => Number.isNaN(new Date(s).getTime())),
        ),
        (source) => {
          const out = formatTransactionDate(source)
          expect(out).toBe(source)
          expect(out).not.toMatch(FORMAT_RE)
        },
      ),
      RUNS,
    )
  })
})
