/**
 * Raw row shape returned by the budgets Edge Function — a thin passthrough of
 * the "Budget" sheet tab (columns A–C). Every field is the trimmed string value
 * read from the sheet, with NO parsing or coercion; the frontend derives
 * spent/remaining/percentage in the pure `computeBudgets` module. This mirrors
 * the identically-named interface in the Deno Edge Function (which cannot import
 * from `src/`).
 */
export interface RawBudgetRow {
  name:     string // col A — Budget (budget name), e.g. "Sink"
  amount:   string // col B — Amount (allotted), e.g. "18,000" or "10000"
  currency: string // col C — Currency, e.g. "PHP"
}
