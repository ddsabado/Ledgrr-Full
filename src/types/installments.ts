/**
 * Raw row shapes returned by the installments / recurring Edge Functions.
 *
 * Both functions are thin passthroughs: every field is the trimmed string value
 * read from the sheet, with NO parsing, coercion, date math, or filtering. All
 * number/date parsing and month evaluation happen on the frontend in
 * `buildInstallmentMonths`. These interfaces are frontend copies of the
 * identically-named interfaces declared in the Deno Edge Functions (which cannot
 * import from `src/`).
 */

/** Raw row from the "Installments" sheet tab (columns A–H). */
export interface RawInstallmentRow {
  name:        string // col A — Installment
  account:     string // col B — Account
  totalAmount: string // col C — Total Amount, e.g. "21,039.60"
  terms:       string // col D — Terms (in mo.), e.g. "5.00"
  termPayment: string // col E — Term Payment, e.g. "4,207.92"
  startDate:   string // col F — Start Date, M/D/YYYY (may be zero-padded)
  budget:      string // col G — Budget
  currency:    string // col H — Currency, e.g. "PHP"
}

/** Raw row from the "Recurring Payments" sheet tab (columns A–I). */
export interface RawRecurringRow {
  name:        string // col A — Name
  account:     string // col B — Account
  amount:      string // col C — Amount, e.g. "169"
  frequency:   string // col D — Frequency, e.g. "Monthly"
  startDate:   string // col E — Start Date, MM/YYYY, e.g. "07/2026"
  endDate:     string // col F — End Date, MM/YYYY, empty = ongoing
  category:    string // col G — Category
  subcategory: string // col H — Subcategory
  currency:    string // col I — Currency, e.g. "PHP"
}

/** Payload accepted by the authenticated /tx Edge Function. */
export interface NewInstallmentInput {
  name: string
  totalAmount: number
  terms: number
  startDate: string
  account: string
  budget: string
  currency: string
  statementDay: number
}
