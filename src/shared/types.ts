/**
 * Types shared between the server and the browser client.
 */

import type { ThemeName } from './themes.js';

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
  /** When the feed was last fetched successfully (ISO), if ever. */
  lastSuccess?: string;
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
  /** `color` is only present when set in config, where it overrides the theme. */
  feeds: { name: string; color?: string }[];
  people: { name: string; color?: string }[];
  display: DisplayPrefs;
  /** Hours the night theme is used when `display.autoNight` is on; null if disabled in config. */
  nightHours: { from: number; to: number } | null;
}

/** Display choices made on the wall, saved on the server. */
export interface DisplayPrefs {
  theme: ThemeName;
  /** Use the night theme during `nightHours`. */
  autoNight: boolean;
}

export interface Person {
  name: string;
  color: string;
}

export interface Todo {
  id: string;
  text: string;
  /** Names of the people this is assigned to; empty means anyone. */
  assignees: string[];
  done: boolean;
  /** ISO time it was ticked off. Done items disappear after midnight. */
  doneAt?: string;
  createdAt: string;
}

export interface NewTodo {
  text: string;
  assignees: string[];
}

export type TodoPatch = Partial<Pick<Todo, 'text' | 'assignees' | 'done'>>;
