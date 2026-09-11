/**
 * Raw row shape returned by the debtsandreceivables Edge Function — a thin
 * passthrough of the "Debts and Receivables" sheet tab (columns A–N). Every
 * field is the trimmed string value read from the sheet, with NO parsing or
 * coercion; the frontend derives everything in computeDebtsReceivables. This
 * mirrors the identically-named interface in the Deno Edge Function (which
 * cannot import from `src/`).
 */
export interface RawDebtReceivableRow {
  name:             string // A — Transaction Name
  account:          string // B — Account (may be empty)
  date:             string // C — Date, M/D/YYYY or MM/DD/YYYY
  totalAmount:      string // D — native total (string)
  participants:     string // E — semicolon list; [0] = owner
  splitBy:          string // F — Split By
  amounts:          string // G — semicolon list, parallel to participants
  category:         string // H — Category
  subcategory:      string // I — Subcategory
  paidParticipants: string // J — Name:amount[:CCY] map; legacy bare Name; may be empty
  status:           string // K — Pending | Settled
  direction:        string // L — Receivable | Payable
  currency:         string // M — row-level currency
  resolvedAmount:   string // N — Resolved Amount (empty for PHP/unresolved)
}

export interface NewDebtReceivableInput {
  name: string
  account: string
  date: string
  totalAmount: number
  participants: Array<{ name: string; share: number }>
  splitBy: 'Exact' | 'Percent'
  category: string
  subcategory: string
  budget: string
  direction: 'Receivable' | 'Payable'
  currency: string
}
