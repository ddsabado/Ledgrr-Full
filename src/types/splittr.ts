export interface SplittrMember { id: string; name: string }
export interface SplittrExpense {
  id: string; description: string; amount: number; currency: string; date: string
  paidByMemberId: string; shares: Array<{ memberId: string; amount: number }>
}
export interface SplittrGroup { id: string; name: string; baseCurrency: string; members: SplittrMember[]; expenses: SplittrExpense[] }
export interface SplittrPreview { group: SplittrGroup }

export interface SplittrImportSelection {
  /** Used once for confirmation; never stored by Ledgrr. */
  share: string
  groupId: string; memberId: string; settledAccount?: string; expenses: Array<{
    expenseId: string; account: string; category: string; subcategory: string; budget: string
  }>
}
export interface SplittrImportResult { imported: string[] }
