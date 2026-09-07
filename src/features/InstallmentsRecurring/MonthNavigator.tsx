import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthNavigatorProps {
  label:      string
  onPrevious: () => void
  onNext:     () => void
}

/**
 * Prev/next month navigator. Mirrors CycleNavigator's styling; navigation is
 * unbounded (ongoing recurring payments have no last month), so both controls
 * are always enabled.
 */
export default function MonthNavigator({ label, onPrevious, onNext }: MonthNavigatorProps) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous month"
        className="text-muted hover:text-text transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <span className="text-sm font-semibold text-text text-center truncate min-w-[7rem]">
        {label}
      </span>

      <button
        type="button"
        onClick={onNext}
        aria-label="Next month"
        className="text-muted hover:text-text transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
