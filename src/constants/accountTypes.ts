/**
 * Account Type classification sourced from the "Account Categories" sheet
 * (Account Type column). Credit-card accounts carry 'Credit'; everything else
 * is 'Debit'. Used to distinguish credit-card accounts from the rest WITHOUT
 * hardcoding the "Credit Cards" category string. A blank/unmapped type is
 * treated as NON-credit so such accounts still appear in Account Balances.
 */
export const CREDIT_ACCOUNT_TYPE = 'Credit'

/** True when an account's type marks it as a credit-card account. */
export function isCreditAccount(accountType: string | undefined | null): boolean {
  return (accountType ?? '') === CREDIT_ACCOUNT_TYPE
}
