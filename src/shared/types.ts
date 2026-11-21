/**
 * Types shared between the server and the browser client.
 */

export interface CalendarEvent {
  /** Stable id: feed name + UID + occurrence start. */
  id: string;
  feed: string;
  color: string;
  title: string;
  location?: string;
  allDay: boolean;
  /**
   * Timed events: ISO-8601 UTC instant (e.g. "2026-11-21T15:00:00.000Z").
   * All-day events: local calendar date "YYYY-MM-DD".
   */
  start: string;
  /** Same format as `start`. Exclusive (all-day end is the day after the last day). */
  end: string;
}

export interface FeedStatus {
  name: string;
  color: string;
  ok: boolean;
  error?: string;
  eventCount: number;
}

export interface EventsResponse {
  events: CalendarEvent[];
  feeds: FeedStatus[];
  fetchedAt: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface Weather {
  temperature: number;
  unit: 'F' | 'C';
  weatherCode: number;
  description: string;
  isDay: boolean;
  high: number | null;
  low: number | null;
  fetchedAt: string;
}

/** Display settings the client needs from config. */
export interface ClientSettings {
  locationName: string;
  weekStartsOn: 0 | 1;
  dayStartHour: number;
  dayEndHour: number;
  refreshMinutes: number;
  feeds: { name: string; color: string }[];
}
