import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import {
  parseAllotted,
  isBudgetTransaction,
  computeSpent,
  computeRemaining,
  computePercentage,
  progressColor,
  barWidthPct,
  computeBudgets,
  resolvePhp,
  ZERO_ALLOTMENT_OVERSPENT_PCT,
} from '@/features/Budgets/computeBudgets'
import type { CurrencyData } from '@/types/accounts'
import type { YearMonth } from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import type { RawTransaction } from '@/types/transactions'
import type { RawBudgetRow } from '@/types/budgets'

const RUNS = { numRuns: 100 }
const FX: CurrencyData = { PHP: 1, JPY: 0.4013862, USD: 62.72, TWD: 1.98465335 }
const ym = (year: number, month1: number): YearMonth => ({ year, month: month1 - 1 })

let seq = 0
function tx(o: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key: o.key ?? `T${seq}`, date: o.date ?? '6/11/2026 0:00:00', account: o.account ?? 'Cash',
    amount: o.amount ?? 100, resolvedAmount: o.resolvedAmount ?? null, currency: o.currency ?? 'PHP',
    targetAccount: o.targetAccount ?? '', type: o.type ?? 'Expense', category: o.category ?? 'Food',
    subcategory: o.subcategory ?? '', budget: o.budget ?? 'Needs', note: o.note ?? '',
  }
}
function budget(o: Partial<RawBudgetRow> = {}): RawBudgetRow {
  return { name: o.name ?? 'Needs', amount: o.amount ?? '18,000', currency: o.currency ?? 'PHP' }
}

// Feature: dashboard-budget, Property 1: Allotted amount parsing strips separators and maps the unparseable to zero
describe('Property 1: allotted parsing', () => {
  it('grouped-thousands parse; always finite and >= 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 99_999_999 }), fc.integer({ min: 0, max: 99 }),
      (whole, cents) => {
        const value = whole + cents / 100
        const grouped = whole.toLocaleString('en-US') + '.' + String(cents).padStart(2, '0')
        const parsed = parseAllotted(grouped)
        expect(parsed).toBeCloseTo(value, 2)
        expect(Number.isFinite(parsed)).toBe(true)
        expect(parsed).toBeGreaterThanOrEqual(0)
      },
    ), RUNS)
  })
  it('empty/whitespace/non-numeric -> 0', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant(''), fc.constant('  '), fc.constant('n/a'), fc.constant('abc')),
      (bad) => { expect(parseAllotted(bad)).toBe(0) },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 2: Budget-transaction membership is the conjunction of type, exact name, and month
describe('Property 2: budget-transaction membership', () => {
  it('true iff exact type, exact non-empty name, and in target month', () => {
    fc.assert(fc.property(
      fc.constantFrom('Expense', 'Split Offset', 'Income', 'Transfer', 'expense'),
      fc.constantFrom('Needs', 'Sink', '', '   ', 'needs'),
      fc.integer({ min: 1, max: 12 }),
      (type, budgetVal, month1) => {
        const target = ym(2026, 6)
        const inMonth = month1 === 6
        const t = tx({ type, budget: budgetVal, date: `${month1}/15/2026 0:00:00` })
        const expected =
          (type === 'Expense' || type === 'Split Offset') &&
          budgetVal.trim() !== '' && budgetVal === 'Needs' && inMonth
        expect(isBudgetTransaction(t, 'Needs', target)).toBe(expected)
      },
    ), RUNS)
  })
  it('always false for blank/whitespace budget', () => {
    fc.assert(fc.property(fc.constantFrom('', ' ', '   ', '\t'), (b) => {
      expect(isBudgetTransaction(tx({ type: 'Expense', budget: b }), b, ym(2026, 6))).toBe(false)
    }), RUNS)
  })
})

// Feature: dashboard-budget, Property 3: Spent equals the sum of resolved PHP amounts (negative Split Offset nets down)
describe('Property 3: spent = sum of resolvePhp; negative Split Offset reduces; empty -> 0', () => {
  it('sums resolved PHP over PHP/JPY, Expense/Split-Offset', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        isOffset:  fc.boolean(),
        jpy:       fc.boolean(),
        mag:       fc.integer({ min: 0, max: 10000 }),
      }), { maxLength: 20 }),
      (specs) => {
        const txs = specs.map((s) => {
          const amount = s.isOffset ? -s.mag : s.mag           // native amount carries sign
          return tx({
            type: s.isOffset ? 'Split Offset' : 'Expense',
            amount, currency: s.jpy ? 'JPY' : 'PHP', resolvedAmount: null,
          })
        })
        const expected = specs.reduce((sum, s) => {
          const amount = s.isOffset ? -s.mag : s.mag
          const php = s.jpy ? amount * FX.JPY : amount
          return sum + php
        }, 0)
        expect(computeSpent(txs, FX)).toBeCloseTo(expected, 4)
      },
    ), RUNS)
    expect(computeSpent([], FX)).toBe(0)
  })
})

// Feature: dashboard-budget, Property 9: resolvePhp — PHP passthrough, resolvedAmount, else amount * fxRate
describe('Property 9: resolvePhp resolution rules', () => {
  it('PHP -> amount; resolvedAmount present -> that; else amount * fxRate', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100000, max: 100000 }),
      fc.constantFrom('PHP', 'JPY', 'USD', 'TWD', 'ZZZ'),
      fc.option(fc.integer({ min: -100000, max: 100000 }), { nil: null }),
      (amount, currency, resolved) => {
        const t = tx({ amount, currency, resolvedAmount: resolved })
        const got = resolvePhp(t, FX)
        if (currency === 'PHP') expect(got).toBeCloseTo(amount, 4)
        else if (resolved != null) expect(got).toBeCloseTo(resolved, 4)
        else expect(got).toBeCloseTo(amount * (FX[currency] ?? 1), 4)
        expect(Number.isFinite(got)).toBe(true)
      },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 4: Remaining is the allotted-minus-spent difference
describe('Property 4: remaining', () => {
  it('remaining === allotted - spent; negative iff spent > allotted', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }),
      (allotted, spent) => {
        const r = computeRemaining(allotted, spent)
        expect(r).toBeCloseTo(allotted - spent, 6)
        expect(r < 0).toBe(spent > allotted)
      },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 5: Percentage is always finite, with correct positive and zero-allotment behavior
describe('Property 5: percentage finiteness + divide-by-zero', () => {
  it('always finite; positive path; 0/0 -> 0; 0/>0 -> finite > 100', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }),
      (allotted, spent) => {
        const pct = computePercentage(allotted, spent)
        expect(Number.isFinite(pct)).toBe(true)
        if (allotted > 0) {
          const raw = (spent / allotted) * 100
          if (Number.isFinite(raw)) expect(pct).toBeCloseTo(raw, 6)
          else expect(pct).toBe(ZERO_ALLOTMENT_OVERSPENT_PCT)
        } else if (spent > 0) {
          expect(pct).toBe(ZERO_ALLOTMENT_OVERSPENT_PCT)
          expect(pct).toBeGreaterThan(100)
        } else {
          expect(pct).toBe(0)
        }
      },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 6: Progress color follows the thresholds with overspend precedence
describe('Property 6: progress color', () => {
  it('red on overspend or >100; amber [80,100]; green <80', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 300, noNaN: true }),
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      (pct, spent, allotted) => {
        const c = progressColor(pct, spent, allotted)
        if (spent > allotted || pct > 100) expect(c).toBe('red')
        else if (pct >= 80) expect(c).toBe('amber')
        else expect(c).toBe('green')
      },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 7: Progress bar fill width is capped at 100 percent
describe('Property 7: bar width cap', () => {
  it('barWidthPct === min(pct, 100), never > 100', () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), (pct) => {
      const w = barWidthPct(pct)
      expect(w).toBe(Math.min(pct, 100))
      expect(w).toBeLessThanOrEqual(100)
    }), RUNS)
  })
})

// Feature: dashboard-budget, Property 8: Assembled budget rows preserve order and the no-match and finiteness invariants
describe('Property 8: assembled rows', () => {
  it('one row per budget in order; no-match -> spent 0, count 0, remaining allotted; finite pct', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ name: fc.string({ minLength: 1 }), amount: fc.constantFrom('18,000', '10000', '', 'x') }), { maxLength: 10 }),
      (specs) => {
        const budgets = specs.map((s) => budget({ name: s.name, amount: s.amount }))
        const rows = computeBudgets(budgets, [], ym(2026, 6))
        expect(rows).toHaveLength(budgets.length)
        rows.forEach((r, i) => {
          expect(r.name).toBe(budgets[i].name)
          expect(r.spent).toBe(0)
          expect(r.count).toBe(0)
          expect(r.remaining).toBe(r.allotted)
          expect(Number.isFinite(r.percentage)).toBe(true)
          expect(r.allotted).toBeGreaterThanOrEqual(0)
        })
      },
    ), RUNS)
  })
})

// Feature: dashboard-budget, Property 11: Collection keys are unique within a fetch
describe('Property 11: collection key uniqueness', () => {
  const getKey = (item: RawBudgetRow, index: number) =>
    `${item.name}#${item.amount}#${item.currency}#${index}`
  it('unique keys even with duplicate rows', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ name: fc.string(), amount: fc.string(), currency: fc.string() }), { maxLength: 30 }),
      (rows) => {
        const keys = rows.map((r, i) => getKey(r as RawBudgetRow, i))
        expect(new Set(keys).size).toBe(rows.length)
      },
    ), RUNS)
  })
})

describe('computeBudgets example/edge cases', () => {
  it('parses "18,000" and "10000"; empty/garbage -> 0', () => {
    expect(parseAllotted('18,000')).toBe(18000)
    expect(parseAllotted('10000')).toBe(10000)
    expect(parseAllotted('')).toBe(0)
    expect(parseAllotted('  ')).toBe(0)
  })
  it('negative Split Offset nets the spend down (native PHP amounts)', () => {
    const txs = [
      tx({ type: 'Expense', budget: 'Needs', amount: 1000, currency: 'PHP', resolvedAmount: null, date: '6/5/2026 0:00:00' }),
      tx({ type: 'Split Offset', budget: 'Needs', amount: -300, currency: 'PHP', resolvedAmount: null, date: '6/6/2026 0:00:00' }),
    ]
    const [row] = computeBudgets([budget({ name: 'Needs', amount: '18,000' })], txs, ym(2026, 6), FX)
    expect(row.spent).toBe(700)
    expect(row.count).toBe(2)
  })
  it('zero-allotment with spend yields finite sentinel > 100 and red', () => {
    const txs = [tx({ type: 'Expense', budget: 'X', amount: 50, currency: 'PHP', resolvedAmount: null, date: '6/1/2026 0:00:00' })]
    const [row] = computeBudgets([budget({ name: 'X', amount: '0' })], txs, ym(2026, 6), FX)
    expect(row.percentage).toBe(ZERO_ALLOTMENT_OVERSPENT_PCT)
    expect(row.color).toBe('red')
  })
  it('case-mismatched budget name and out-of-month txs are excluded', () => {
    const txs = [
      tx({ type: 'Expense', budget: 'needs', amount: 100, date: '6/1/2026 0:00:00' }),
      tx({ type: 'Expense', budget: 'Needs', amount: 100, date: '7/1/2026 0:00:00' }),
    ]
    const [row] = computeBudgets([budget({ name: 'Needs' })], txs, ym(2026, 6), FX)
    expect(row.count).toBe(0)
    expect(row.spent).toBe(0)
  })
})
