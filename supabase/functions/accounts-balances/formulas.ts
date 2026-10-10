/**
 * The original Current Balance formula used for all credit-card accounts.
 * Keep this byte-for-byte equivalent to the pre-adjustment behavior.
 */
export function currentBalanceFormula(row: number): string {
  return `=D${row}+SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Expense")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E${row},Currency!$A:$B,2,0),1))+SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Transfer")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E${row},Currency!$A:$B,2,0),1))-SUMPRODUCT((Transactions!G2:G=A${row})*(Transactions!H2:H="Transfer")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E${row},Currency!$A:$B,2,0),1))`
}

/** Current Balance formula for a non-credit account that has an Adjustment row. */
export function adjustedCurrentBalanceFormula(row: number): string {
  const conversion = `IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E${row},Currency!$A:$B,2,0),1)`
  return `=D${row}+SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Income")*Transactions!D2:D*${conversion})+SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Adjustment")*Transactions!D2:D*${conversion})+SUMPRODUCT((Transactions!G2:G=A${row})*(Transactions!H2:H="Transfer")*Transactions!D2:D*${conversion})-SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Expense")*Transactions!D2:D*${conversion})-SUMPRODUCT((Transactions!C2:C=A${row})*(Transactions!H2:H="Transfer")*Transactions!D2:D*${conversion})`
}
