import { useRef, type PointerEventHandler } from "react";

const DIRECTION_LOCK_PX = 12;
const SWIPE_THRESHOLD_PX = 72;
const MOBILE_QUERY = "(max-width: 1023px)";

const EXCLUDED_SELECTOR = [
  "[data-swipe-exclude]",
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[role='button']",
  "[role='tab']",
  "[role='dialog']",
  "[contenteditable='true']",
].join(",");

interface SwipeStart {
  pointerId: number;
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
 * leaves vertical scrolling and every nested control to their native behavior.
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

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (
      !latest.current.enabled ||
      event.pointerType !== "touch" ||
      !isMobileTouch() ||
      (event.target instanceof Element && event.target.closest(EXCLUDED_SELECTOR))
    ) {
      return;
    }

    start.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      direction: null,
    };
  };

  const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const active = start.current;
    if (!active || active.pointerId !== event.pointerId || active.direction) return;

    const horizontalDistance = Math.abs(event.clientX - active.x);
    const verticalDistance = Math.abs(event.clientY - active.y);
    if (Math.max(horizontalDistance, verticalDistance) < DIRECTION_LOCK_PX) return;

    active.direction = horizontalDistance > verticalDistance ? "horizontal" : "vertical";
  };

  const clear = () => {
    start.current = null;
  };

  const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
    const active = start.current;
    clear();
    if (
      !active ||
      active.pointerId !== event.pointerId ||
      active.direction !== "horizontal" ||
      !latest.current.enabled
    ) {
      return;
    }

    const distance = event.clientX - active.x;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    if (distance < 0) latest.current.onSwipeLeft?.();
    else latest.current.onSwipeRight?.();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: clear };
}
