import type { RawTransaction } from '@/types/transactions'
import type { CurrencyData } from '@/types/accounts'

/**
 * Resolves a transaction's PHP value on the FRONTEND from the currencies
 * collection FX map. This is the single source of truth for PHP conversion —
 * the transactions Edge Function is a pure passthrough and does NOT compute it.
 *
 * Rules:
 *   - PHP currency          → the native amount as-is
 *   - resolvedAmount present → that value (already PHP, manually resolved)
 *   - otherwise             → amount × fxRate(currency), rate defaulting to 1
 *
 * The native `amount` carries its own sign (a Split Offset's amount is
 * negative in the sheet), so the resolved PHP value nets down naturally.
 */
export function resolvePhp(tx: RawTransaction, fxMap: CurrencyData): number {
  const currency = (tx.currency || 'PHP').trim() || 'PHP'
  const amount = Number(tx.amount) || 0
  if (currency === 'PHP') return amount
  if (tx.resolvedAmount != null && Number.isFinite(tx.resolvedAmount)) {
    return tx.resolvedAmount
  }
  const rate = fxMap[currency]
  return amount * (Number.isFinite(rate) ? rate : 1)
}
