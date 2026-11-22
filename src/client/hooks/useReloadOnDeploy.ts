import { usePolling } from './usePolling';

/**
 * Reload the page when the server starts serving a different build (after a deploy),
 * so the wall never needs a manual refresh. Waits if someone is mid-edit.
 */
export function useReloadOnDeploy(intervalMs = 60_000): void {
  usePolling(() => {
    fetch('/api/version', { signal: AbortSignal.timeout(5_000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ version: string }>) : null))
      .then((body) => {
        if (!body || body.version === 'dev') return;
        const seen = (window as { __servedVersion?: string }).__servedVersion;
        if (seen === undefined) {
          (window as { __servedVersion?: string }).__servedVersion = body.version;
        } else if (seen !== body.version && !document.querySelector('[role="dialog"]')) {
          window.location.reload();
        }
      })
      .catch(() => {
        /* server restarting or offline; try again next time */
      });
  }, intervalMs);
}
