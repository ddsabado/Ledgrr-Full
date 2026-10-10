export interface AdjustBalanceInput {
  accountName?: unknown
  targetBalance?: unknown
}

export interface ValidAdjustBalanceInput {
  accountName: string
  targetBalance: number
}

export function isAdjustBalanceInput(value: unknown): value is ValidAdjustBalanceInput {
  if (!value || typeof value !== 'object') return false
  const input = value as AdjustBalanceInput
  return typeof input.accountName === 'string' && input.accountName.trim() !== '' &&
    typeof input.targetBalance === 'number' && Number.isFinite(input.targetBalance)
}

/** Formats an adjustment timestamp in the spreadsheet's Manila-local M/D/YYYY H:mm:ss format. */
export function formatAdjustmentTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('month')}/${value('day')}/${value('year')} ${value('hour')}:${value('minute')}:${value('second')}`
}

/** Converts a signed native-currency delta into Transactions sheet columns B:L. */
export function adjustmentTransactionRow(date: string, accountName: string, currency: string, delta: number, targetBalance: number): string[] {
  return [date, accountName, String(delta), '', currency, '', 'Adjustment', 'Adjustment', '', '', `Manual adjustment: ${targetBalance}`]
}
