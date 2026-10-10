import { useRef, type TouchEvent } from "react";

const DIRECTION_LOCK_PX = 12;
const SWIPE_THRESHOLD_PX = 72;
const MOBILE_QUERY = "(max-width: 1023px)";

interface SwipeStart {
  x: number;
  y: number;
  direction: "horizontal" | "vertical" | null;
}

interface UseMobileCardSwipeOptions {
  enabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * A deliberately conservative touch-only shortcut for dashboard cards. It
 * locks only after a clear horizontal intent, so the gesture works from every
 * part of the card without interfering with vertical scrolling.
 */
export function useMobileCardSwipe({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
}: UseMobileCardSwipeOptions) {
  const start = useRef<SwipeStart | null>(null);
  const latest = useRef({ enabled, onSwipeLeft, onSwipeRight });
  latest.current = { enabled, onSwipeLeft, onSwipeRight };

  const isMobileTouch = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_QUERY).matches;

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (
      !latest.current.enabled ||
      event.touches.length !== 1 ||
      !isMobileTouch()
    ) {
      start.current = null;
      return;
    }

    const touch = event.touches[0];
    start.current = {
      x: touch.clientX,
      y: touch.clientY,
      direction: null,
    };
  };

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    const active = start.current;
    if (!active || event.touches.length !== 1 || active.direction) return;

    const touch = event.touches[0];
    const horizontalDistance = Math.abs(touch.clientX - active.x);
    const verticalDistance = Math.abs(touch.clientY - active.y);
    if (Math.max(horizontalDistance, verticalDistance) < DIRECTION_LOCK_PX) return;

    active.direction = horizontalDistance > verticalDistance ? "horizontal" : "vertical";
  };

  const clear = () => {
    start.current = null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const active = start.current;
    clear();
    if (
      !active ||
      active.direction !== "horizontal" ||
      !latest.current.enabled
    ) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) return;
    const distance = touch.clientX - active.x;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    if (distance < 0) latest.current.onSwipeLeft?.();
    else latest.current.onSwipeRight?.();
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: clear };
}
