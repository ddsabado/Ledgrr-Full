import { useId, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipPosition {
  left: number
  top: number
}

/** Compact, immediate hover/focus tooltip for notes that are visually truncated. */
export default function TransactionNoteTooltip({ note }: { note: string }) {
  const tooltipId = useId()
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  const showTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setPosition({ left: rect.left, top: rect.top - 6 })
  }

  return (
    <>
      <p
        className="mt-0.5 cursor-pointer truncate text-xs text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        tabIndex={0}
        aria-describedby={position ? tooltipId : undefined}
        onPointerEnter={(event) => showTooltip(event.currentTarget)}
        onPointerLeave={() => setPosition(null)}
        onFocus={(event) => showTooltip(event.currentTarget)}
        onBlur={() => setPosition(null)}
      >
        {note}
      </p>
      {position && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[100] max-w-xs -translate-y-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text shadow-lg"
          style={{ left: position.left, top: position.top }}
        >
          {note}
        </span>,
        document.body,
      )}
    </>
  )
}
