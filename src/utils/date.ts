const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
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
