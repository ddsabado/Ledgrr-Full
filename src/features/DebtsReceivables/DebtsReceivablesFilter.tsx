import { ListFilter, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'

export interface DRFilters {
  range?:   DateRange
  name?:    string
  status?:  'Pending' | 'Settled'
  account?: string
}

export function isFilterActive(f: DRFilters): boolean {
  return Boolean(f.range?.from || (f.name && f.name.trim() !== '') || f.status || f.account)
}

interface DebtsReceivablesFilterProps {
  filters:  DRFilters
  onChange: (next: DRFilters) => void
  /** Distinct account values present in the current records. */
  accounts: string[]
}

/** Filter icon + popover for the Debts & Receivables panel. */
export default function DebtsReceivablesFilter({
  filters,
  onChange,
  accounts,
}: DebtsReceivablesFilterProps) {
  const active = isFilterActive(filters)

  const set = (patch: Partial<DRFilters>) => onChange({ ...filters, ...patch })
  const clear = () => onChange({})

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter debts & receivables"
          className="relative rounded-md p-1 text-muted transition-colors hover:text-text hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ListFilter aria-hidden="true" className="w-4 h-4" />
          {active && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent"
              data-testid="dr-filter-active"
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
              onClick={clear}
              className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              <X aria-hidden="true" className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Date range */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Date range</span>
          <DateRangePicker
            value={filters.range}
            onChange={(range) => set({ range })}
          />
        </label>

        {/* Name */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Name</span>
          <input
            type="text"
            value={filters.name ?? ''}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Search name"
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        {/* Status */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Status</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) => set({ status: (e.target.value || undefined) as DRFilters['status'] })}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Any</option>
            <option value="Pending">Pending</option>
            <option value="Settled">Settled</option>
          </select>
        </label>

        {/* Account */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Account</span>
          <select
            value={filters.account ?? ''}
            onChange={(e) => set({ account: e.target.value || undefined })}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Any</option>
            {accounts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </PopoverContent>
    </Popover>
  )
}
