import type { CalendarEvent, EventsResponse, FeedStatus } from '../../shared/types.js';
import { wallTimeToUtcMs } from './timezone.js';

export interface FeedOutcome {
  status: FeedStatus;
  events: CalendarEvent[];
}

/** Sortable instant for an event; all-day dates are placed at local midnight. */
export function eventStartMs(e: CalendarEvent, timeZone: string): number {
  if (!e.allDay) return Date.parse(e.start);
  const [year, month, day] = e.start.split('-').map(Number) as [number, number, number];
  return wallTimeToUtcMs({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
}

/**
 * Combine per-feed results into one response: events sorted by start
 * (all-day before timed on the same instant, then longer first, then title).
 */
export function mergeFeeds(
  outcomes: FeedOutcome[],
  range: { start: Date; end: Date },
  timeZone: string,
  now = new Date(),
): EventsResponse {
  const keyed = outcomes
    .flatMap((o) => o.events)
    .map((e) => ({ e, start: eventStartMs(e, timeZone), end: e.allDay ? 0 : Date.parse(e.end) }));

  keyed.sort(
    (a, b) =>
      a.start - b.start ||
      Number(b.e.allDay) - Number(a.e.allDay) ||
      b.end - a.end ||
      a.e.title.localeCompare(b.e.title) ||
      a.e.feed.localeCompare(b.e.feed),
  );

  return {
    events: keyed.map((k) => k.e),
    feeds: outcomes.map((o) => o.status),
    fetchedAt: now.toISOString(),
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
  };
}
