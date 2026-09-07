import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import {
  parseAmount,
  parseInstallmentStart,
  parseTerms,
  monthDiff,
  isInstallmentActive,
  isRecurringActive,
  normalizeFrequency,
  buildInstallmentMonths,
  shiftMonth,
  type YearMonth,
} from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import type { RawInstallmentRow, RawRecurringRow } from '@/types/installments'

const RUNS = { numRuns: 100 }

const pad2 = (n: number) => String(n).padStart(2, '0')

function inst(o: Partial<RawInstallmentRow> = {}): RawInstallmentRow {
  return {
    name: o.name ?? 'Item', account: o.account ?? 'Card',
    totalAmount: o.totalAmount ?? '0', terms: o.terms ?? '3',
    termPayment: o.termPayment ?? '100', startDate: o.startDate ?? '6/1/2026',
    budget: o.budget ?? '', currency: o.currency ?? 'PHP',
  }
}
function rec(o: Partial<RawRecurringRow> = {}): RawRecurringRow {
  return {
    name: o.name ?? 'Sub', account: o.account ?? 'Card', amount: o.amount ?? '100',
    frequency: o.frequency ?? 'Monthly', startDate: o.startDate ?? '06/2026',
    endDate: o.endDate ?? '', category: o.category ?? '', subcategory: o.subcategory ?? '',
    currency: o.currency ?? 'PHP',
  }
}

const ym = (year: number, month1: number): YearMonth => ({ year, month: month1 - 1 })

// ── Property 1 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 1: Installment active window and iteration numbering
describe('Property 1: installment active window and iteration numbering', () => {
  it('active in exactly T months start..start+T-1; iteration = offset+1', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2000, max: 2100 }), fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 60 }), fc.integer({ min: -3, max: 70 }),
      (year, month1, terms, offset) => {
        const start = ym(year, month1)
        const target = shiftMonth(start, offset)
        const active = isInstallmentActive(start, terms, target)
        expect(active).toBe(offset >= 0 && offset <= terms - 1)
        if (active) {
          const row = inst({ startDate: `${month1}/1/${year}`, terms: String(terms) })
          const result = buildInstallmentMonths([row], [], target)
          expect(result.items[0].iteration).toBe(offset + 1)
          expect(result.items[0].terms).toBe(terms)
        }
      },
    ), RUNS)
  })
})

// ── Property 2 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 2: Installment start-date parsing is padding-invariant and month-precise
describe('Property 2: installment start parsing padding-invariant + month-precise', () => {
  it('padded and non-padded forms parse to the same year/month regardless of day', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }), fc.integer({ min: 2000, max: 2100 }),
      (m, d, y) => {
        const padded = parseInstallmentStart(`${pad2(m)}/${pad2(d)}/${y}`)
        const bare = parseInstallmentStart(`${m}/${d}/${y}`)
        expect(padded).toEqual(bare)
        expect(padded).toEqual({ year: y, month: m - 1 })
      },
    ), RUNS)
  })
})

// ── Property 3 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 3: Terms parsing normalizes whole-number decimals and rejects invalid values
describe('Property 3: terms parsing', () => {
  it('"n.00"/"n.0" -> n for n>=1', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 60 }), (n) => {
      expect(parseTerms(`${n}.00`)).toBe(n)
      expect(parseTerms(`${n}.0`)).toBe(n)
      expect(parseTerms(String(n))).toBe(n)
    }), RUNS)
  })
  it('empty/non-numeric/<1 -> null and excluded from all months', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant(''), fc.constant('   '), fc.constant('abc'), fc.constant('0'), fc.constant('-3')),
      (bad) => {
        expect(parseTerms(bad)).toBeNull()
        const r = buildInstallmentMonths([inst({ terms: bad })], [], ym(2026, 6))
        expect(r.items).toHaveLength(0)
        expect(r.omittedInstallments).toBe(1)
      },
    ), RUNS)
  })
})

// ── Property 4 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 4: Installments degrade gracefully with an observable omission count
describe('Property 4: installments graceful degradation + omission count', () => {
  it('bad rows omitted+counted, good rows processed, never throws', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        good: fc.boolean(),
      }), { maxLength: 20 }),
      (specs) => {
        const rows = specs.map((s) => s.good
          ? inst({ startDate: '6/1/2026', terms: '3' })
          : inst({ startDate: '', terms: '3' }))
        const target = ym(2026, 6)
        const r = buildInstallmentMonths(rows, [], target)
        const badCount = specs.filter((s) => !s.good).length
        expect(r.omittedInstallments).toBe(badCount)
        // every good row active at start month
        expect(r.items).toHaveLength(specs.length - badCount)
      },
    ), RUNS)
  })
})

// ── Property 5 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 5: Recurring bounded active window is month-precise
describe('Property 5: recurring bounded window month-precise', () => {
  it('active exactly start..end inclusive when end>=start; day-invariant', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2000, max: 2098 }), fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 0, max: 24 }), fc.integer({ min: -3, max: 30 }),
      (year, month1, span, offset) => {
        const start = ym(year, month1)
        const end = shiftMonth(start, span)
        const target = shiftMonth(start, offset)
        expect(isRecurringActive(start, end, target)).toBe(offset >= 0 && offset <= span)
      },
    ), RUNS)
  })
})

// ── Property 6 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 6: Recurring ongoing window (empty or unparseable end) capped at the current month
describe('Property 6: recurring ongoing window capped at current month', () => {
  it('empty/unparseable end active from start month through the current month only (no future)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2000, max: 2098 }), fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 0, max: 60 }),   // span from start to "now" (current month)
      fc.integer({ min: -6, max: 90 }),  // target offset from start
      fc.oneof(fc.constant(''), fc.constant('   '), fc.constant('garbage'), fc.constant('13/2026')),
      (year, month1, nowSpan, offset, endRaw) => {
        const start = ym(year, month1)
        const now = shiftMonth(start, nowSpan)   // current month is nowSpan months after start
        const target = shiftMonth(start, offset)
        const r = buildInstallmentMonths(
          [], [rec({ startDate: `${pad2(month1)}/${year}`, endDate: endRaw })],
          target, now,
        )
        // active iff start <= target <= now  ⇔  0 <= offset <= nowSpan
        expect(r.items.length).toBe(offset >= 0 && offset <= nowSpan ? 1 : 0)
      },
    ), RUNS)
  })
})

// ── Property 7 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 7: Frequency label defaults to "Monthly"
describe('Property 7: frequency default', () => {
  it('trimmed value or "Monthly" when empty/whitespace', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const out = normalizeFrequency(s)
      expect(out).toBe(s.trim() === '' ? 'Monthly' : s.trim())
    }), RUNS)
  })
})

// ── Property 8 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 8: Recurring payments degrade gracefully with an observable omission count
describe('Property 8: recurring graceful degradation + omission count', () => {
  it('bad start rows omitted+counted, good processed, never throws', () => {
    fc.assert(fc.property(
      fc.array(fc.boolean(), { maxLength: 20 }),
      (goods) => {
        const rows = goods.map((g) => g ? rec({ startDate: '06/2026' }) : rec({ startDate: '' }))
        const r = buildInstallmentMonths([], rows, ym(2026, 6))
        const bad = goods.filter((g) => !g).length
        expect(r.omittedRecurring).toBe(bad)
        expect(r.items).toHaveLength(goods.length - bad)
      },
    ), RUNS)
  })
})

// ── Property 9 ───────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 9: Amount parsing strips separators and maps the unparseable to zero
describe('Property 9: amount parsing', () => {
  it('grouped-thousands strings parse; empty/garbage -> 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 99_999_999 }), fc.integer({ min: 0, max: 99 }),
      (whole, cents) => {
        const value = whole + cents / 100
        const grouped = whole.toLocaleString('en-US') + '.' + pad2(cents)
        expect(parseAmount(grouped)).toBeCloseTo(value, 2)
      },
    ), RUNS)
  })
  it('unparseable -> 0 flows into item amount and total', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant(''), fc.constant('   '), fc.constant('n/a'), fc.constant('abc')),
      (bad) => {
        expect(parseAmount(bad)).toBe(0)
        const r = buildInstallmentMonths([inst({ termPayment: bad, startDate: '6/1/2026', terms: '2' })], [], ym(2026, 6))
        expect(r.items[0].amount).toBe(0)
        expect(r.total).toBe(0)
      },
    ), RUNS)
  })
})

// ── Property 10 ──────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 10: Monthly total equals the sum of active item amounts
describe('Property 10: monthly total = sum of active item amounts', () => {
  it('total equals sum over active items; 0 when none', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 10000 }), { maxLength: 15 }),
      fc.array(fc.integer({ min: 0, max: 10000 }), { maxLength: 15 }),
      (instAmts, recAmts) => {
        const target = ym(2026, 6)
        const insts = instAmts.map((a) => inst({ startDate: '6/1/2026', terms: '3', termPayment: String(a) }))
        const recs = recAmts.map((a) => rec({ startDate: '06/2026', endDate: '', amount: String(a) }))
        const r = buildInstallmentMonths(insts, recs, target)
        const expected = [...instAmts, ...recAmts].reduce((s, n) => s + n, 0)
        expect(r.total).toBeCloseTo(expected, 6)
        expect(r.total).toBe(r.items.reduce((s, i) => s + i.amount, 0))
      },
    ), RUNS)
  })
})

// ── Property 11 ──────────────────────────────────────────────────────────────
// Feature: dashboard-installment-recurring, Property 11: Active list membership and descending order
describe('Property 11: active list membership + descending order', () => {
  it('exactly active items, sorted by amount non-increasing', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ amt: fc.integer({ min: 0, max: 9999 }), off: fc.integer({ min: -2, max: 5 }) }), { maxLength: 20 }),
      (specs) => {
        const target = ym(2026, 6)
        // installments start `off` months before target with terms=3 (active iff 0<=off<=2)
        const insts = specs.map((s) => {
          const start = shiftMonth(target, -s.off)
          return inst({ startDate: `${start.month + 1}/1/${start.year}`, terms: '3', termPayment: String(s.amt) })
        })
        const r = buildInstallmentMonths(insts, [], target)
        const expectedActive = specs.filter((s) => s.off >= 0 && s.off <= 2).length
        expect(r.items).toHaveLength(expectedActive)
        for (let i = 1; i < r.items.length; i++) {
          expect(r.items[i - 1].amount).toBeGreaterThanOrEqual(r.items[i].amount)
        }
      },
    ), RUNS)
  })
})

// ── Example / edge cases ─────────────────────────────────────────────────────
describe('builder example/edge cases', () => {
  it('parses "5.00" terms as 5 and zero-padded start 07/08/2026', () => {
    const r = buildInstallmentMonths([inst({ startDate: '07/08/2026', terms: '5.00', termPayment: '4,207.92' })], [], ym(2026, 7))
    expect(r.items[0].iteration).toBe(1)
    expect(r.items[0].terms).toBe(5)
    expect(r.items[0].amount).toBeCloseTo(4207.92, 2)
  })
  it('recurring empty end is ongoing from start through the current month, not future', () => {
    const now = ym(2026, 9) // pretend "today" is Sep 2026
    // current month → shown
    const atNow = buildInstallmentMonths([], [rec({ startDate: '07/2026', endDate: '' })], now, now)
    expect(atNow.items).toHaveLength(1)
    expect(atNow.items[0].frequency).toBe('Monthly')
    expect(atNow.items[0].isRecurring).toBe(true)
    // a month within [start, now] → shown
    const midWindow = buildInstallmentMonths([], [rec({ startDate: '07/2026', endDate: '' })], ym(2026, 8), now)
    expect(midWindow.items).toHaveLength(1)
    // a future month beyond now → NOT shown
    const future = buildInstallmentMonths([], [rec({ startDate: '07/2026', endDate: '' })], ym(2026, 10), now)
    expect(future.items).toHaveLength(0)
  })
  it('recurring end < start is never active but not omitted', () => {
    const r = buildInstallmentMonths([], [rec({ startDate: '06/2026', endDate: '01/2026' })], ym(2026, 6))
    expect(r.items).toHaveLength(0)
    expect(r.omittedRecurring).toBe(0)
  })
  it('both empty inputs -> empty items + total 0', () => {
    const r = buildInstallmentMonths([], [], ym(2026, 6))
    expect(r.items).toEqual([])
    expect(r.total).toBe(0)
  })
  it('monthDiff sign', () => {
    expect(monthDiff(ym(2026, 1), ym(2026, 3))).toBe(2)
    expect(monthDiff(ym(2026, 3), ym(2026, 1))).toBe(-2)
  })
})
