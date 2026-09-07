import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  groupTransactions,
  findPeriodIndexForSwitch,
  classifyFlow,
  signedAmount,
  parseTxDate,
  type PeriodBucket,
} from '@/features/Transactions/groupTransactions'
import type { RawTransaction } from '@/types/transactions'

// ─── Fixture factory ─────────────────────────────────────────────────────────

let seq = 0
function tx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key:            overrides.key ?? `T${seq}`,
    date:           overrides.date ?? '6/11/2026 0:00:00',
    account:        overrides.account ?? 'Cash',
    amount:         overrides.amount ?? 100,
    resolvedAmount: overrides.resolvedAmount ?? null,
    currency:       overrides.currency ?? 'PHP',
    targetAccount:  overrides.targetAccount ?? '',
    type:           overrides.type ?? 'Expense',
    category:       overrides.category ?? 'Food',
    subcategory:    overrides.subcategory ?? '',
    note:           overrides.note ?? '',
    determined:     overrides.determined ?? false,
    phpValue:       overrides.phpValue ?? 100,
  }
}

/** Find a bucket by key across a period list. */
function byKey(periods: PeriodBucket[], key: string): PeriodBucket | undefined {
  return periods.find((p) => p.key === key)
}

beforeEach(() => {
  seq = 0
})

// ─── parseTxDate ─────────────────────────────────────────────────────────────

describe('parseTxDate', () => {
  it('parses the sheet M/D/YYYY H:mm:ss format at local midnight', () => {
    const d = parseTxDate('6/11/2026 0:00:00')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June (0-indexed)
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(0)
  })

  it('returns null for empty / unparseable input', () => {
    expect(parseTxDate('')).toBeNull()
    expect(parseTxDate('   ')).toBeNull()
    expect(parseTxDate('not-a-date')).toBeNull()
  })
})

// ─── classifyFlow ────────────────────────────────────────────────────────────

describe('classifyFlow', () => {
  it('classifies Income and Expense (case-insensitive)', () => {
    expect(classifyFlow(tx({ type: 'Expense' }))).toBe('Expense')
    expect(classifyFlow(tx({ type: 'income' }))).toBe('Income')
    expect(classifyFlow(tx({ type: 'INCOME' }))).toBe('Income')
  })

  it('returns null for non-flow and blank types', () => {
    for (const t of ['Transfer', 'Adjustment', 'Receivables', '']) {
      expect(classifyFlow(tx({ type: t }))).toBeNull()
    }
  })

  it('folds Split Offset into the Expense flow', () => {
    expect(classifyFlow(tx({ type: 'Split Offset' }))).toBe('Expense')
    expect(classifyFlow(tx({ type: 'split offset' }))).toBe('Expense')
  })
})

// ─── Split Offset netting ────────────────────────────────────────────────────

describe('groupTransactions — Split Offset offsets Expense totals', () => {
  it('nets a negative Split Offset down against its category (subcategory case)', () => {
    const rows = [
      tx({ type: 'Expense', category: 'Food', subcategory: 'Eating out', phpValue: 1000 }),
      tx({ type: 'Split Offset', category: 'Food', subcategory: 'Eating out', phpValue: -300 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    const food = byKey(periods, 'Jun 2026')!.Expense.Food
    expect(food.total).toBe(700)
    expect(food.subcats['Eating out'].total).toBe(700)
  })

  it('nets a negative direct Split Offset against the category total', () => {
    const rows = [
      tx({ type: 'Expense', category: 'Travel', phpValue: 5000 }),
      tx({ type: 'Split Offset', category: 'Travel', subcategory: '', phpValue: -2000 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    const travel = byKey(periods, 'Jun 2026')!.Expense.Travel
    expect(travel.total).toBe(3000)
    // Both direct txs (expense + offset) live under txs.
    expect(travel.txs).toHaveLength(2)
  })

  it('classifies Split Offset under Expense, never Income', () => {
    const { periods } = groupTransactions(
      [tx({ type: 'Split Offset', category: 'Food', phpValue: -100 })],
      'month',
    )
    const bucket = byKey(periods, 'Jun 2026')!
    expect(bucket.Income.Food).toBeUndefined()
    expect(bucket.Expense.Food.total).toBe(-100)
  })
})

describe('signedAmount', () => {
  it('returns the signed value for Split Offset and abs otherwise', () => {
    expect(signedAmount(tx({ type: 'Split Offset', phpValue: -300 }))).toBe(-300)
    expect(signedAmount(tx({ type: 'Expense', phpValue: 250 }))).toBe(250)
    expect(signedAmount(tx({ type: 'Expense', phpValue: -250 }))).toBe(250)
  })
})

// ─── Exclusions & aggregation ────────────────────────────────────────────────

describe('groupTransactions — exclusions and aggregation', () => {
  it('excludes Transfer/Adjustment/Receivables from the breakdown', () => {
    const rows = [
      tx({ type: 'Expense', category: 'Food', phpValue: 100 }),
      tx({ type: 'Transfer', category: 'Food', phpValue: 999 }),
      tx({ type: 'Adjustment', category: 'Food', phpValue: 999 }),
      tx({ type: 'Receivables', category: 'Food', phpValue: 999 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    const bucket = byKey(periods, 'Jun 2026')!
    expect(bucket.Expense.Food.total).toBe(100)
  })

  it('uses absolute phpValue so totals are positive magnitudes', () => {
    const rows = [
      tx({ type: 'Expense', category: 'Food', phpValue: -250 }),
      tx({ type: 'Income', category: 'Salary', phpValue: 5000 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    const b = byKey(periods, 'Jun 2026')!
    expect(b.Expense.Food.total).toBe(250)
    expect(b.Income.Salary.total).toBe(5000)
  })

  it('splits direct vs subcategory transactions and sums category total across both', () => {
    const rows = [
      tx({ category: 'Food', subcategory: '', phpValue: 40 }),           // direct
      tx({ category: 'Food', subcategory: 'Groceries', phpValue: 60 }),
      tx({ category: 'Food', subcategory: 'Groceries', phpValue: 30 }),
      tx({ category: 'Food', subcategory: 'Dining', phpValue: 20 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    const food = byKey(periods, 'Jun 2026')!.Expense.Food
    expect(food.total).toBe(150)
    expect(food.txs).toHaveLength(1)          // 1 direct
    expect(food.subcats.Groceries.total).toBe(90)
    expect(food.subcats.Groceries.txs).toHaveLength(2)
    expect(food.subcats.Dining.total).toBe(20)
  })

  it('maps blank category to "Uncategorized"', () => {
    const { periods } = groupTransactions([tx({ category: '', phpValue: 10 })], 'month')
    expect(byKey(periods, 'Jun 2026')!.Expense.Uncategorized.total).toBe(10)
  })

  it('drops rows with empty/unparseable dates', () => {
    const rows = [
      tx({ date: '', phpValue: 100 }),
      tx({ date: 'garbage', phpValue: 100 }),
      tx({ date: '6/11/2026 0:00:00', phpValue: 100 }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    expect(periods).toHaveLength(1)
    expect(byKey(periods, 'Jun 2026')!.Expense.Food.total).toBe(100)
  })
})

// ─── Month bucketing ─────────────────────────────────────────────────────────

describe('groupTransactions — month mode', () => {
  it('buckets by calendar month, chronologically ordered', () => {
    const rows = [
      tx({ date: '8/15/2026 0:00:00' }),
      tx({ date: '6/11/2026 0:00:00' }),
      tx({ date: '7/01/2026 0:00:00' }),
    ]
    const { periods } = groupTransactions(rows, 'month')
    expect(periods.map((p) => p.key)).toEqual(['Jun 2026', 'Jul 2026', 'Aug 2026'])
  })
})

// ─── Week bucketing (ISO) ────────────────────────────────────────────────────

describe('groupTransactions — week mode', () => {
  it('buckets by ISO week with correct key and label', () => {
    // 2026-09-07 is a Monday → ISO week 37 of 2026; week Sep 7 – 13.
    const { periods } = groupTransactions([tx({ date: '9/7/2026 0:00:00' })], 'week')
    expect(periods).toHaveLength(1)
    expect(periods[0].key).toBe('2026-W37')
    expect(periods[0].label).toBe('Week 37 · Sep 7 – 13')
  })

  it('groups Mon–Sun of the same ISO week together', () => {
    const rows = [
      tx({ date: '9/7/2026 0:00:00', phpValue: 10 }),  // Mon
      tx({ date: '9/13/2026 0:00:00', phpValue: 5 }),  // Sun (same week)
      tx({ date: '9/14/2026 0:00:00', phpValue: 7 }),  // next Mon
    ]
    const { periods } = groupTransactions(rows, 'week')
    expect(periods.map((p) => p.key)).toEqual(['2026-W37', '2026-W38'])
    expect(periods[0].Expense.Food.total).toBe(15)
    expect(periods[1].Expense.Food.total).toBe(7)
  })
})

// ─── Day bucketing (enumerates empty days) ───────────────────────────────────

describe('groupTransactions — day mode', () => {
  it('enumerates every calendar day between min and max, including empty ones', () => {
    const rows = [
      tx({ date: '9/7/2026 0:00:00' }),
      tx({ date: '9/10/2026 0:00:00' }),
    ]
    const { periods } = groupTransactions(rows, 'day')
    expect(periods.map((p) => p.key)).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    ])
    // Empty middle days have no categories.
    expect(Object.keys(byKey(periods, '2026-09-08')!.Expense)).toHaveLength(0)
    expect(byKey(periods, '2026-09-07')!.label).toBe('Mon, Sep 7')
  })
})

// ─── currentIndex / findIndexForToday ────────────────────────────────────────

describe('groupTransactions — currentIndex', () => {
  afterEach(() => vi.useRealTimers())

  it('points at the bucket containing today when present', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // Jul 15 2026
    const rows = [
      tx({ date: '6/11/2026 0:00:00' }),
      tx({ date: '7/02/2026 0:00:00' }),
      tx({ date: '8/01/2026 0:00:00' }),
    ]
    const { periods, currentIndex } = groupTransactions(rows, 'month')
    expect(periods[currentIndex].key).toBe('Jul 2026')
  })

  it('falls back to the last period when today is beyond the data range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 1)) // well after data
    const rows = [tx({ date: '6/11/2026 0:00:00' }), tx({ date: '7/02/2026 0:00:00' })]
    const { periods, currentIndex } = groupTransactions(rows, 'month')
    expect(currentIndex).toBe(periods.length - 1)
    expect(periods[currentIndex].key).toBe('Jul 2026')
  })
})

// ─── findPeriodIndexForSwitch ────────────────────────────────────────────────

describe('findPeriodIndexForSwitch', () => {
  const rows = [
    tx({ date: '6/11/2026 0:00:00' }),
    tx({ date: '7/02/2026 0:00:00' }),
    tx({ date: '7/20/2026 0:00:00' }),
    tx({ date: '8/05/2026 0:00:00' }),
  ]

  it('maps finer→coarser to the period containing the viewed date (week→month)', () => {
    const weeks = groupTransactions(rows, 'week').periods
    const months = groupTransactions(rows, 'month').periods
    // Pick the week containing 7/20/2026.
    const wIdx = weeks.findIndex((w) => w.key === '2026-W30') // Jul 20 2026 is ISO W30
    expect(wIdx).toBeGreaterThanOrEqual(0)
    const mIdx = findPeriodIndexForSwitch(weeks, wIdx, months, 'week', 'month')
    expect(months[mIdx].key).toBe('Jul 2026')
  })

  it('maps coarser→finer to the first finer period within the range (month→week)', () => {
    const months = groupTransactions(rows, 'month').periods
    const weeks = groupTransactions(rows, 'week').periods
    const mIdx = months.findIndex((m) => m.key === 'Jul 2026')
    const wIdx = findPeriodIndexForSwitch(months, mIdx, weeks, 'month', 'week')
    // First week bucket that falls inside July 2026.
    const july = weeks[wIdx]
    expect(july.key.startsWith('2026-W')).toBe(true)
    // Its start date should be within July.
    expect(['2026-W27', '2026-W28', '2026-W29', '2026-W30']).toContain(july.key)
  })

  it('returns 0 when either period list is empty', () => {
    const months = groupTransactions(rows, 'month').periods
    expect(findPeriodIndexForSwitch(months, 0, [], 'month', 'week')).toBe(0)
    expect(findPeriodIndexForSwitch([], 0, months, 'week', 'month')).toBe(0)
  })
})
