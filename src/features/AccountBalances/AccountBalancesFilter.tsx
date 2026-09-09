import { ListFilter, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface AccountBalanceFilters {
  name?: string
  currency?: string
  category?: string
}

export function isAccountBalanceFilterActive(filters: AccountBalanceFilters): boolean {
  return Boolean(filters.name?.trim() || filters.currency || filters.category)
}

interface AccountBalancesFilterProps {
  filters: AccountBalanceFilters
  onChange: (next: AccountBalanceFilters) => void
  currencies: string[]
  categories: string[]
}

/** Filter icon + popover for the Account Balances panel. */
export default function AccountBalancesFilter({
  filters,
  onChange,
  currencies,
  categories,
}: AccountBalancesFilterProps) {
  const active = isAccountBalanceFilterActive(filters)

  const set = (patch: Partial<AccountBalanceFilters>) => onChange({ ...filters, ...patch })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter account balances"
          className="relative rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ListFilter aria-hidden="true" className="h-4 w-4" />
          {active && (
            <span
              aria-hidden="true"
              data-testid="account-balances-filter-active"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Filters</span>
          {active && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="flex items-center gap-1 rounded text-xs text-muted transition-colors hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X aria-hidden="true" className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Account name</span>
          <input
            type="search"
            value={filters.name ?? ''}
            onChange={(event) => set({ name: event.target.value })}
            placeholder="Search account"
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Currency</span>
          <select
            value={filters.currency ?? ''}
            onChange={(event) => set({ currency: event.target.value || undefined })}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Any</option>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Account category</span>
          <select
            value={filters.category ?? ''}
            onChange={(event) => set({ category: event.target.value || undefined })}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Any</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
      </PopoverContent>
    </Popover>
  )
}
