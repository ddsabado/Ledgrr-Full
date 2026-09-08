import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, type DateRange } from '@/components/ui/calendar'

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

/** Theme-aware date-range picker: a Popover trigger showing the formatted
 *  range, opening a range-mode Calendar. */
export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Any date',
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const label =
    value?.from && value?.to
      ? `${format(value.from, 'MMM d, yyyy')} – ${format(value.to, 'MMM d, yyyy')}`
      : value?.from
        ? `${format(value.from, 'MMM d, yyyy')} –`
        : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-1.5 text-left text-sm text-text transition-colors',
            'hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            !value?.from && 'text-muted',
            className,
          )}
        >
          <CalendarIcon aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-muted" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar mode="range" selected={value} onSelect={onChange} numberOfMonths={1} />
      </PopoverContent>
    </Popover>
  )
}
