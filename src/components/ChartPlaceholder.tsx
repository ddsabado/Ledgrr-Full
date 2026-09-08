interface ChartPlaceholderProps {
  /** Tailwind height class matching the chart this replaces (e.g. "h-56", "h-64"). */
  height: string
  /** Empty-state label; defaults to a neutral message. */
  label?: string
}

/**
 * Fixed-height empty-state stand-in for a chart. Rendered in a chart's reserved
 * slot when there is no data to chart, so the layout below (total row, list)
 * does not shift. Exposed to assistive tech as a status indicator, not an
 * interactive control.
 */
export default function ChartPlaceholder({ height, label = 'No data to display' }: ChartPlaceholderProps) {
  return (
    <div role="status" className={`${height} w-full flex items-center justify-center`}>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}
