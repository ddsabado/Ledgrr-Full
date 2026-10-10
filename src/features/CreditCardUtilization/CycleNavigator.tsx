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
        className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface2 active:bg-accent active:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <span className="text-sm font-semibold text-text text-center truncate">{label}</span>

      <button
        type="button"
        onClick={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        aria-label="Next cycle"
        className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface2 active:bg-accent active:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
