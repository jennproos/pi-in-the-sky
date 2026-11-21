import { useEffect, useRef } from 'react';

/** Run `fn` now and every `intervalMs`, and again when the page becomes visible or the network returns. */
export function usePolling(fn: () => void, intervalMs: number, deps: unknown[] = []): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const run = () => ref.current();
    run();
    const id = setInterval(run, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, ...deps]);
}
