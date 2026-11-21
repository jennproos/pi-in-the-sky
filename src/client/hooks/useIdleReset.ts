import { useEffect, useRef } from 'react';

/**
 * Calls `reset` once nobody has touched the screen for `idleMs`, and again whenever
 * `dayKey` changes (midnight) while idle, so the wall always drifts back to "now".
 */
export function useIdleReset(idleMs: number, reset: () => void, dayKey: string): void {
  const resetRef = useRef(reset);
  resetRef.current = reset;
  const lastTouch = useRef(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onTouch = () => {
      lastTouch.current = Date.now();
      clearTimeout(timer);
      timer = setTimeout(() => resetRef.current(), idleMs);
    };
    window.addEventListener('pointerdown', onTouch, { capture: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onTouch, { capture: true });
    };
  }, [idleMs]);

  useEffect(() => {
    if (Date.now() - lastTouch.current >= idleMs) resetRef.current();
  }, [dayKey, idleMs]);
}
