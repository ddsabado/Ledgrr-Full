const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export interface LocalCalendarDay {
  /** A local-date identifier used only to group adjacent rendered transactions. */
  key: string
  /** Human-readable label for the transaction-list date divider. */
  label: string
  /** A machine-readable local date when the source value can be parsed. */
  dateTime?: string
}

/**
 * Returns a local calendar-day label for transaction-list grouping. Invalid
 * source values remain visible as their own fallback group instead of being
 * coerced into a different day.
 */
export function getLocalCalendarDay(source: string): LocalCalendarDay {
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) {
    return {
      key: `invalid:${source}`,
      label: source.trim() || 'Invalid date',
    }
  }

  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  return {
    key: `${year}-${pad2(month + 1)}-${pad2(day)}`,
    label: `${MONTHS[month]} ${pad2(day)}, ${year}`,
    dateTime: `${year}-${pad2(month + 1)}-${pad2(day)}`,
  }
}

/**
 * Formats a transaction source date as `Mmm dd | hh:mm AM/PM` in the viewer's
 * local timezone. Returns the original string unchanged when it is empty,
 * whitespace-only, or cannot be parsed into a valid date. (R4.1, R4.3, R4.4)
 */
export function formatTransactionDate(source: string): string {
  if (!source || source.trim() === '') return source

  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return source

  const mmm = MONTHS[date.getMonth()]
  const dd = pad2(date.getDate())

  const hours24 = date.getHours()
  let h = hours24 % 12
  if (h === 0) h = 12
  const hh = pad2(h)
  const mm = pad2(date.getMinutes())
  const marker = hours24 < 12 ? 'AM' : 'PM'

  return `${mmm} ${dd} | ${hh}:${mm} ${marker}`
}

/** Formats a credit-card transaction date as `Mmm dd hh:mm AM/PM`. */
export function formatCreditCardTransactionDate(source: string): string {
  return formatTransactionDate(source).replace(' | ', ' ')
}
