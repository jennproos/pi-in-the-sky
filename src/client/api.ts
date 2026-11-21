import type { ClientSettings, EventsResponse, Weather } from '../shared/types';

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  settings: () => getJson<ClientSettings>('/api/settings'),
  weather: () => getJson<Weather>('/api/weather'),
  events: (start: Date, end: Date) =>
    getJson<EventsResponse>(
      `/api/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
    ),
};
