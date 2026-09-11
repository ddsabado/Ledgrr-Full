/** Consolidated category/subcategory reference data from Txn_Categories and Txn_Subcategories. */
export interface TxnCategory {
  category: string
  type: string
  budget: string
  subcategories: string[]
}
