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
        className="text-gray-400 hover:text-white transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <span className="text-sm text-gray-300 text-center truncate">{label}</span>

      <button
        type="button"
        onClick={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        aria-label="Next period"
        className="text-gray-400 hover:text-white transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
