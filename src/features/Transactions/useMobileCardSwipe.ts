import { useEffect, useRef, useState, type TouchEvent } from 'react'

const MOBILE_QUERY = '(max-width: 1023px) and (pointer: coarse)'
const DIRECTION_LOCK_DISTANCE = 12
const SWIPE_THRESHOLD = 48

type SwipeDirection = 'previous' | 'next'

interface UseMobileCardSwipeOptions {
  enabled: boolean
  reducedMotion: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
}

interface TouchStart {
  x: number
  y: number
  direction: 'pending' | 'horizontal' | 'vertical'
}

const isMobileTouchViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_QUERY).matches

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A deliberate swipe accelerator for a dashboard card. It accepts gestures
 * from the entire card, locks direction before the threshold, and leaves
 * vertical scrolling fully native.
 */
export function useMobileCardSwipe({
  enabled,
  reducedMotion,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: UseMobileCardSwipeOptions) {
  const touchStart = useRef<TouchStart | null>(null)
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [feedback, setFeedback] = useState<SwipeDirection | null>(null)

  useEffect(() => () => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
  }, [])

  const reset = () => {
    touchStart.current = null
  }

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (
      !enabled ||
      !isMobileTouchViewport() ||
      event.touches.length !== 1
    ) {
      reset()
      return
    }

    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, direction: 'pending' }
  }

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    if (!start || event.touches.length !== 1 || start.direction !== 'pending') return

    const touch = event.touches[0]
    const horizontalDistance = Math.abs(touch.clientX - start.x)
    const verticalDistance = Math.abs(touch.clientY - start.y)
    if (Math.max(horizontalDistance, verticalDistance) < DIRECTION_LOCK_DISTANCE) return

    start.direction = horizontalDistance > verticalDistance ? 'horizontal' : 'vertical'
  }

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    reset()
    if (!start || start.direction !== 'horizontal' || !enabled || !isMobileTouchViewport()) return

    const touch = event.changedTouches[0]
    if (!touch) return
    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = Math.abs(touch.clientY - start.y)
    if (Math.abs(horizontalDistance) < SWIPE_THRESHOLD || Math.abs(horizontalDistance) <= verticalDistance) return

    const direction: SwipeDirection = horizontalDistance > 0 ? 'previous' : 'next'
    const canNavigate = direction === 'previous' ? canGoPrevious : canGoNext
    if (!canNavigate) return

    if (direction === 'previous') onPrevious()
    else onNext()

    // A brief, finger-direction nudge confirms a completed change without
    // turning the card into a draggable surface. The interaction itself still
    // works when motion is reduced; only this visual confirmation is omitted.
    // Check the media query at completion too: it avoids even a transient
    // gesture nudge if the preference changes before Motion has re-rendered.
    if (!reducedMotion && !prefersReducedMotion()) {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
      setFeedback(direction)
      feedbackTimeout.current = setTimeout(() => setFeedback(null), 140)
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset, feedback }
}
