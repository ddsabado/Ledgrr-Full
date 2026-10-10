import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '../../../@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../@/components/ui/popover'
import { Calendar } from '../../../@/components/ui/calendar'

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

/** A controlled single-date picker using the app's shared Popover and Calendar. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Select date"
          className={cn(
            'w-full justify-start px-2.5 font-normal',
            !value && 'text-muted',
            className,
          )}
        >
          <CalendarIcon aria-hidden="true" data-icon="inline-start" />
          {value ? format(value, 'LLL dd, y') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          defaultMonth={value}
        />
      </PopoverContent>
    </Popover>
  )
}
