/**
 * Formats a numeric amount as a currency string using Intl.NumberFormat.
 * @param amount   The numeric value to format
 * @param currency ISO 4217 currency code (e.g. 'PHP', 'USD', 'TWD')
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
