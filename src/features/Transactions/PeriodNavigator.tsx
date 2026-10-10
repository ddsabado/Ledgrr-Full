import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PeriodNavigatorProps {
  label:         string
  onPrevious:    () => void // older period
  onNext:        () => void // newer period
  canGoPrevious: boolean
  canGoNext:     boolean
}

/**
 * Prev/next navigator for the active period. Mirrors CycleNavigator's styling
 * with period-appropriate aria labels.
 */
export default function PeriodNavigator({
  label,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: PeriodNavigatorProps) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={canGoPrevious ? onPrevious : undefined}
        disabled={!canGoPrevious}
        aria-label="Previous period"
        className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface2 active:bg-accent active:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="text-sm font-semibold text-text text-center truncate"
      >
        {label}
      </span>

      <button
        type="button"
        onClick={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        aria-label="Next period"
        className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface2 active:bg-accent active:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
