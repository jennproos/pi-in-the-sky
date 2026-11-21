import { useCallback, useRef, useState } from 'react';
import type { EventsResponse, FeedStatus } from '../../shared/types';
import { api } from '../api';
import { usePolling } from './usePolling';

export interface EventsState {
  data: EventsResponse | null;
  /** Last time any request for events succeeded. */
  lastSuccess: Date | null;
  /** Set when the most recent request failed outright (server unreachable, etc). */
  error: string | null;
  /** Feeds the server could not refresh on the most recent successful request. */
  failedFeeds: FeedStatus[];
  refresh: () => void;
}

/**
 * Loads events for [start, end) and re-polls every `intervalMs`. Responses are cached
 * per range so paging back and forth is instant, and the last good data is kept on failure.
 */
export function useEvents(start: Date, end: Date, intervalMs: number): EventsState {
  const key = `${start.toISOString()}/${end.toISOString()}`;
  const cache = useRef(new Map<string, EventsResponse>());
  const currentKey = useRef(key);
  currentKey.current = key;

  const [, force] = useState(0);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const requested = key;
    api.events(start, end).then(
      (res) => {
        cache.current.set(requested, res);
        if (cache.current.size > 12) cache.current.delete(cache.current.keys().next().value!);
        if (currentKey.current !== requested) return;
        setLastSuccess(new Date());
        setError(null);
        force((n) => n + 1);
      },
      (err: unknown) => {
        if (currentKey.current !== requested) return;
        setError(err instanceof Error ? err.message : String(err));
      },
    );
    // start/end are captured via key
  }, [key]);

  usePolling(load, intervalMs, [key]);

  const data = cache.current.get(key) ?? null;
  return {
    data,
    lastSuccess,
    error,
    failedFeeds: data?.feeds.filter((f) => !f.ok) ?? [],
    refresh: load,
  };
}
