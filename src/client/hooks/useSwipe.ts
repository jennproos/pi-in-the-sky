import { useRef, type MouseEvent, type PointerEvent } from 'react';

export type SwipeDirection = 'left' | 'right';

const MIN_DISTANCE = 90;
const MAX_DURATION_MS = 900;

/**
 * Horizontal swipe detection with pointer events (works for touch and mouse).
 * Spread the returned handlers on a container. A click that ends a swipe is swallowed
 * so swiping across a day header doesn't also open that day.
 */
export function useSwipe(onSwipe: (dir: SwipeDirection) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swallowClick = useRef(false);

  return {
    onPointerDown(e: PointerEvent) {
      start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      swallowClick.current = false;
    },
    onPointerUp(e: PointerEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) >= MIN_DISTANCE && Math.abs(dx) > 1.5 * Math.abs(dy) && e.timeStamp - s.t <= MAX_DURATION_MS) {
        swallowClick.current = true;
        onSwipe(dx < 0 ? 'left' : 'right');
      }
    },
    onPointerCancel() {
      start.current = null;
    },
    onClickCapture(e: MouseEvent) {
      if (swallowClick.current) {
        swallowClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
