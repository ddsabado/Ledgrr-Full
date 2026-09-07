import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CycleNavigatorProps {
  label:         string
  onPrevious:    () => void // older cycle
  onNext:        () => void // newer cycle
  canGoPrevious: boolean
  canGoNext:     boolean
}

export default function CycleNavigator({
  label,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: CycleNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={canGoPrevious ? onPrevious : undefined}
        disabled={!canGoPrevious}
        aria-label="Previous cycle"
        className="text-muted hover:text-text transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <span className="text-sm text-text text-center truncate">{label}</span>

      <button
        type="button"
        onClick={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        aria-label="Next cycle"
        className="text-muted hover:text-text transition-colors rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
