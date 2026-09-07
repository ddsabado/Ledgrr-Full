import type { RawTransaction } from '@/types/transactions'

// ─── Exported Types ─────────────────────────────────────────────────────────

export type PeriodMode = 'month' | 'week' | 'day'

/**
 * Aggregated data for one category within a period + flow.
 * `txs` holds transactions posted directly to the category (no subcategory);
 * `subcats` holds per-subcategory aggregates. `total` is the sum of both.
 * All amounts are PHP (phpValue), stored as positive magnitudes.
 */
export interface CategoryData {
  total:   number
  txs:     RawTransaction[]
  subcats: Record<string, { total: number; txs: RawTransaction[] }>
}

/**
 * A single period bucket (one month, ISO week, or day) holding the category
 * breakdown for each flow. Ported from the reference SPA.
 */
export interface PeriodBucket {
  key:     string
  label:   string
  Income:  Record<string, CategoryData>
  Expense: Record<string, CategoryData>
}

export interface GroupedPeriods {
  periods:      PeriodBucket[]
  currentIndex: number
}

export type FlowType = 'Income' | 'Expense'

// ─── Date Helpers (native — no date-fns) ──────────────────────────────────────
//
// Neither this project nor the reference SPA actually ships date-fns, and the
// existing frontend date math (see useCCTransactions.ts) uses plain Date. These
// helpers reimplement the small slice of date-fns the SPA relied on
// (parse, format pieces, ISO-week math, month/day boundaries, day enumeration)
// using only the Date API, normalised to LOCAL midnight so comparisons are
// purely calendar-date based.

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Parses a transaction date string into a Date normalised to local midnight.
 * Mirrors useCCTransactions.parseDate: relies on the JS Date constructor
 * (the transactions sheet emits Date-constructor-parseable strings), and
 * returns null for empty/unparseable input.
 */
export function parseTxDate(raw: string): Date | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/** Local-midnight copy of a date (strips any time component). */
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Last calendar day of the month containing `date`, at local midnight. */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Monday (ISO) of the week containing `date`, at local midnight.
 * getDay(): 0=Sun..6=Sat; ISO week starts Monday, so Sunday maps back 6 days.
 */
function startOfISOWeek(date: Date): Date {
  const d = atMidnight(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
}

/** Sunday (ISO week end) of the week containing `date`, at local midnight. */
function endOfISOWeek(date: Date): Date {
  const start = startOfISOWeek(date)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
}

/**
 * ISO 8601 week number (1–53). The ISO week year assigns weeks by their
 * Thursday, so we shift to the Thursday of the current ISO week and count
 * weeks from that year's first Thursday.
 */
function getISOWeek(date: Date): number {
  const d = atMidnight(date)
  // Thursday of this week determines the ISO year.
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (4 - day))
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstThursdayDay = firstThursday.getDay() === 0 ? 7 : firstThursday.getDay()
  const week1Monday = new Date(
    firstThursday.getFullYear(),
    firstThursday.getMonth(),
    firstThursday.getDate() + (1 - firstThursdayDay),
  )
  const diffDays = Math.round((thursday.getTime() - week1Monday.getTime()) / MS_PER_DAY)
  return Math.floor(diffDays / 7) + 1
}

/** ISO week-numbering year for `date` (may differ from calendar year at edges). */
function getISOWeekYear(date: Date): number {
  const d = atMidnight(date)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (4 - day))
  return thursday.getFullYear()
}

/** Every calendar day in [start, end] inclusive, at local midnight. */
function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let cursor = atMidnight(start)
  const last = atMidnight(end)
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }
  return days
}

// ─── Key + Label Formatters ────────────────────────────────────────────────

/** Month key/label, e.g. "Sep 2026". */
function getMonthKey(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
}

/** ISO week key, e.g. "2026-W37". Uses ISO week-year, not calendar year. */
function getWeekKey(date: Date): string {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Week label, e.g. "Week 37 · Sep 7 – 13" (or cross-month "Sep 28 – Oct 4"). */
function getWeekLabel(weekStart: Date): string {
  const week = getISOWeek(weekStart)
  const weekEnd = endOfISOWeek(weekStart)
  const startMonth = MONTHS_SHORT[weekStart.getMonth()]
  const startDay = weekStart.getDate()
  const endMonth = MONTHS_SHORT[weekEnd.getMonth()]
  const endDay = weekEnd.getDate()
  if (startMonth === endMonth) {
    return `Week ${week} · ${startMonth} ${startDay} – ${endDay}`
  }
  return `Week ${week} · ${startMonth} ${startDay} – ${endMonth} ${endDay}`
}

/** Day key, e.g. "2026-09-07". */
function getDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Day label, e.g. "Mon, Sep 7". */
function getDayLabel(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}


// ─── Flow Classification + Flattening ────────────────────────────────────────
//
// The sheet's "Txn_Type" tab defines the canonical Transaction Type values:
//   Expense, Income, Transfer, Adjustment, Receivables, Split Offset.
// Displayed flows: Income and Expense. Split Offset is folded into the Expense
// flow because it represents a reimbursement/offset of a shared expense — in
// the live data these rows are always NEGATIVE (e.g. -2,286.27 Food/Eating out),
// so they NET DOWN the category they belong to rather than adding to it.
// Transfer, Adjustment, Receivables and blank values are excluded entirely.

/**
 * A transaction annotated with its resolved flow, parsed date, and the PHP
 * amount used for aggregation. `amount` is a positive magnitude for regular
 * Expense/Income (all positive in the sheet) but the SIGNED phpValue for Split
 * Offset (negative), so offsets subtract from their category total.
 */
interface FlatTransaction {
  tx:      RawTransaction
  flow:    FlowType
  date:    Date
  amount:  number
}

/**
 * Classifies a transaction's flow from its `type` (col H, "Transaction Type").
 *
 * `Income` and `Expense` map to their flows; `Split Offset` is folded into the
 * `Expense` flow (as a negative offset). Every other canonical type (Transfer,
 * Adjustment, Receivables) and any blank/unknown value returns null and is
 * dropped. Matching is case-insensitive.
 */
export function classifyFlow(tx: RawTransaction): FlowType | null {
  const t = tx.type.trim().toLowerCase()
  if (t === 'income') return 'Income'
  if (t === 'expense') return 'Expense'
  if (t === 'split offset') return 'Expense'
  return null
}

/**
 * The signed PHP amount a transaction contributes to its category total:
 * negative (offsetting) for Split Offset, positive magnitude otherwise. Use
 * this anywhere direct-transaction totals are recomputed outside the engine so
 * they stay consistent with buildCategoryData.
 */
export function signedAmount(tx: RawTransaction): number {
  return tx.type.trim().toLowerCase() === 'split offset'
    ? tx.phpValue
    : Math.abs(tx.phpValue)
}

/**
 * Flattens raw collection rows into classified, date-parsed entries ready for
 * bucketing. Rows are dropped when the flow is not resolved or the date is
 * empty/unparseable.
 *
 * Amount convention: regular Expense/Income use `Math.abs(phpValue)` (they are
 * positive in the sheet). Split Offset uses the SIGNED `phpValue` (negative),
 * so it offsets — nets down — the expense category it shares.
 */
function flattenTransactions(rows: RawTransaction[]): FlatTransaction[] {
  const out: FlatTransaction[] = []
  for (const tx of rows) {
    const flow = classifyFlow(tx)
    if (!flow) continue
    const date = parseTxDate(tx.date)
    if (!date) continue
    out.push({
      tx,
      flow,
      date,
      amount: signedAmount(tx),
    })
  }
  return out
}

/**
 * Builds the category → subcategory aggregate map for one flow from a set of
 * flat transactions. Direct (no-subcategory) rows go under `txs`; the rest are
 * grouped by `subcategory`. Ported from the SPA's buildCategoryData.
 */
function buildCategoryData(
  flats: FlatTransaction[],
  flow:  FlowType,
): Record<string, CategoryData> {
  const result: Record<string, CategoryData> = {}

  for (const f of flats) {
    if (f.flow !== flow) continue
    const cat = f.tx.category || 'Uncategorized'

    let entry = result[cat]
    if (!entry) {
      entry = { total: 0, txs: [], subcats: {} }
      result[cat] = entry
    }

    entry.total += f.amount

    const sub = f.tx.subcategory.trim()
    if (sub) {
      let subEntry = entry.subcats[sub]
      if (!subEntry) {
        subEntry = { total: 0, txs: [] }
        entry.subcats[sub] = subEntry
      }
      subEntry.total += f.amount
      subEntry.txs.push(f.tx)
    } else {
      entry.txs.push(f.tx)
    }
  }

  return result
}

// ─── Bucketing ────────────────────────────────────────────────────────────

/**
 * Groups flat transactions into period buckets keyed by `keyOf`, labelled by
 * `labelOf`, ordered chronologically by a representative date `dateOf`.
 * A shared implementation for month and week grouping.
 */
function bucketBy(
  flats:   FlatTransaction[],
  keyOf:   (d: Date) => string,
  labelOf: (repr: Date) => string,
  reprOf:  (d: Date) => Date,
): PeriodBucket[] {
  const map = new Map<string, FlatTransaction[]>()
  const repr = new Map<string, Date>()

  for (const f of flats) {
    const key = keyOf(f.date)
    if (!map.has(key)) {
      map.set(key, [])
      repr.set(key, reprOf(f.date))
    }
    map.get(key)!.push(f)
  }

  return [...map.keys()]
    .sort((a, b) => repr.get(a)!.getTime() - repr.get(b)!.getTime())
    .map((key) => {
      const group = map.get(key)!
      return {
        key,
        label:   labelOf(repr.get(key)!),
        Income:  buildCategoryData(group, 'Income'),
        Expense: buildCategoryData(group, 'Expense'),
      }
    })
}

function groupByMonth(flats: FlatTransaction[]): PeriodBucket[] {
  return bucketBy(
    flats,
    getMonthKey,
    (repr) => getMonthKey(repr),
    (d) => new Date(d.getFullYear(), d.getMonth(), 1),
  )
}

function groupByWeek(flats: FlatTransaction[]): PeriodBucket[] {
  return bucketBy(
    flats,
    getWeekKey,
    (repr) => getWeekLabel(repr),
    (d) => startOfISOWeek(d),
  )
}

/**
 * Day grouping enumerates EVERY calendar day between the earliest and latest
 * transaction (inclusive), so empty days still appear as navigable buckets —
 * matching the SPA's groupByDay.
 */
function groupByDay(flats: FlatTransaction[]): PeriodBucket[] {
  if (flats.length === 0) return []

  let min = flats[0].date
  let max = flats[0].date
  for (const f of flats) {
    if (f.date.getTime() < min.getTime()) min = f.date
    if (f.date.getTime() > max.getTime()) max = f.date
  }

  const byDay = new Map<string, FlatTransaction[]>()
  for (const f of flats) {
    const key = getDayKey(f.date)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(f)
  }

  return eachDayOfInterval(min, max).map((day) => {
    const key = getDayKey(day)
    const group = byDay.get(key) ?? []
    return {
      key,
      label:   getDayLabel(day),
      Income:  buildCategoryData(group, 'Income'),
      Expense: buildCategoryData(group, 'Expense'),
    }
  })
}

// ─── Default-Period Selection ────────────────────────────────────────────────

/** Range [start, end] (local midnight) covered by a bucket key in `mode`. */
function keyRange(key: string, mode: PeriodMode): { start: Date; end: Date } | null {
  const start = keyToDate(key, mode)
  if (!start) return null
  switch (mode) {
    case 'month': return { start, end: endOfMonth(start) }
    case 'week':  return { start, end: endOfISOWeek(start) }
    case 'day':   return { start, end: start }
  }
}

/** Representative start Date for a bucket key in `mode`. */
function keyToDate(key: string, mode: PeriodMode): Date | null {
  switch (mode) {
    case 'month': {
      const [mon, year] = key.split(' ')
      const mi = MONTHS_SHORT.indexOf(mon as (typeof MONTHS_SHORT)[number])
      if (mi < 0) return null
      return new Date(Number(year), mi, 1)
    }
    case 'week': {
      const m = key.match(/^(\d{4})-W(\d{2})$/)
      if (!m) return null
      const year = Number(m[1])
      const week = Number(m[2])
      // Monday of ISO week 1 is the Monday on/before Jan 4.
      const jan4 = new Date(year, 0, 4)
      const week1Monday = startOfISOWeek(jan4)
      return new Date(
        week1Monday.getFullYear(),
        week1Monday.getMonth(),
        week1Monday.getDate() + (week - 1) * 7,
      )
    }
    case 'day': {
      const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!m) return null
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    }
  }
}

/**
 * Index of the period containing today, or the last period when today is past
 * the data range (falls back to 0 when empty). Ported from the SPA.
 */
function findIndexForToday(periods: PeriodBucket[], mode: PeriodMode): number {
  if (periods.length === 0) return 0
  const today = atMidnight(new Date())
  const todayKey =
    mode === 'month' ? getMonthKey(today)
    : mode === 'week' ? getWeekKey(today)
    : getDayKey(today)
  const idx = periods.findIndex((p) => p.key === todayKey)
  return idx >= 0 ? idx : periods.length - 1
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Groups flat collection rows into period buckets for the requested mode.
 * All windowing/aggregation is in-memory; callers precompute all three modes
 * once per collection change (see useTransactionsByPeriod).
 */
export function groupTransactions(
  rows: RawTransaction[],
  mode: PeriodMode,
): GroupedPeriods {
  const flats = flattenTransactions(rows)
  const periods =
    mode === 'month' ? groupByMonth(flats)
    : mode === 'week' ? groupByWeek(flats)
    : groupByDay(flats)
  return { periods, currentIndex: findIndexForToday(periods, mode) }
}

/** Granularity rank — higher is finer. */
function modeGranularity(mode: PeriodMode): number {
  return mode === 'month' ? 0 : mode === 'week' ? 1 : 2
}

/**
 * Maps the currently-viewed period index into the equivalent index in a new
 * mode's period list, so switching Month/Week/Day keeps the user's place.
 *
 * Finer → Coarser: the target period that contains the current date.
 * Coarser → Finer: the first target period inside the current range (preferring
 *                  today when switching to Day). Ported from the SPA.
 */
export function findPeriodIndexForSwitch(
  currentPeriods: PeriodBucket[],
  currentIdx:     number,
  newPeriods:     PeriodBucket[],
  fromMode:       PeriodMode,
  toMode:         PeriodMode,
): number {
  if (newPeriods.length === 0 || currentPeriods.length === 0) return 0

  const safeIdx = Math.max(0, Math.min(currentIdx, currentPeriods.length - 1))
  const currentBucket = currentPeriods[safeIdx]
  const delta = modeGranularity(fromMode) - modeGranularity(toMode)

  if (delta > 0) {
    // Finer → Coarser: find the coarser period containing the current date.
    const date = keyToDate(currentBucket.key, fromMode)
    if (!date) return newPeriods.length - 1
    for (let i = 0; i < newPeriods.length; i++) {
      const range = keyRange(newPeriods[i].key, toMode)
      if (range && date >= range.start && date <= range.end) return i
    }
    return newPeriods.length - 1
  }

  // Coarser → Finer: prefer today when switching to Day.
  if (toMode === 'day') {
    const todayKey = getDayKey(atMidnight(new Date()))
    const todayIdx = newPeriods.findIndex((p) => p.key === todayKey)
    if (todayIdx >= 0) return todayIdx
  }

  const range = keyRange(currentBucket.key, fromMode)
  if (!range) return newPeriods.length - 1
  for (let i = 0; i < newPeriods.length; i++) {
    const date = keyToDate(newPeriods[i].key, toMode)
    if (date && date >= range.start && date <= range.end) return i
  }
  return newPeriods.length - 1
}
