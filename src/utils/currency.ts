/**
 * Formats a numeric amount as a currency string using Intl.NumberFormat,
 * rendering the resolved currency symbol (e.g. ₱, US$).
 *
 * @param amount   The numeric value to format
 * @param currency ISO 4217 currency code (e.g. 'PHP', 'USD', 'TWD')
 *
 * Falls back to PHP when the provided code is empty or not a valid ISO 4217
 * currency, so a malformed sheet value never throws a RangeError.
 */
export function formatCurrency(amount: number, currency: string): string {
  const code = (currency ?? '').trim().toUpperCase()
  const opts: Intl.NumberFormatOptions = {
    style:                 'currency',
    currency:              code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }
  try {
    return new Intl.NumberFormat('en-PH', opts).format(amount)
  } catch {
    // Invalid/empty currency code — fall back to PHP so rendering never breaks.
    return new Intl.NumberFormat('en-PH', { ...opts, currency: 'PHP' }).format(amount)
  }
}
