import { DayPicker, getDefaultClassNames, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'

import { cn } from '@/lib/utils'

export type { DateRange }

/**
 * Theme-aware calendar built on react-day-picker (v10). Styled with design
 * tokens so it matches every theme mode. Consumed by DateRangePicker.
 */
export function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()
  return (
    <DayPicker
      className={cn('text-sm', className)}
      classNames={{
        root:            cn(defaults.root, 'text-text'),
        months:          cn(defaults.months, 'relative'),
        month_caption:   cn(defaults.month_caption, 'flex justify-center py-1 font-display text-sm'),
        caption_label:   cn(defaults.caption_label, 'text-text'),
        nav:             cn(defaults.nav, 'flex items-center gap-1'),
        button_previous: cn(defaults.button_previous, 'text-muted hover:text-text'),
        button_next:     cn(defaults.button_next, 'text-muted hover:text-text'),
        chevron:         cn(defaults.chevron, 'fill-muted'),
        weekday:         cn(defaults.weekday, 'text-muted text-xs font-normal'),
        day:             cn(defaults.day, 'text-text'),
        day_button:      cn(defaults.day_button, 'hover:bg-surface2 rounded-md transition-colors'),
        today:           cn(defaults.today, 'text-accent font-semibold'),
        selected:        cn(defaults.selected, '[&>button]:bg-accent [&>button]:text-white'),
        range_middle:    cn(defaults.range_middle, '[&>button]:bg-surface2 [&>button]:text-text'),
        outside:         cn(defaults.outside, 'text-muted/50'),
        disabled:        cn(defaults.disabled, 'text-muted/40'),
        ...classNames,
      }}
      {...props}
    />
  )
}
