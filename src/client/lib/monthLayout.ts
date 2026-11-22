import { addDays } from 'date-fns';
import type { CalendarEvent } from '../../shared/types';
import { dayKey, eventsForDay } from './dates';

/** A multi-day all-day event drawn as one bar across the days it covers in a week row. */
export interface MonthBar {
  event: CalendarEvent;
  /** First column (0–6) of this piece of the bar. */
  col: number;
  span: number;
  lane: number;
  /** The event begins in this piece (rounded left end), rather than continuing from before. */
  startsHere: boolean;
  /** The event ends in this piece (rounded right end), rather than continuing after. */
  endsHere: boolean;
}

/** A single-day event (timed, or all-day for one day) in one day cell. */
export interface MonthChip {
  event: CalendarEvent;
  col: number;
  lane: number;
}

/** "+N more" in the last lane of a day cell that has more items than lanes. */
export interface MonthMore {
  col: number;
  lane: number;
  count: number;
}

export interface MonthWeekLayout {
  bars: MonthBar[];
  chips: MonthChip[];
  more: MonthMore[];
}

/** All-day events covering more than one day are drawn as bars. */
export function isMultiDayAllDay(e: CalendarEvent): boolean {
  return e.allDay && dayKey(addDays(parseKey(e.start), 1)) < e.end;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/**
 * Lays out one week row of the month grid in `lanes` lines per day. Bars go in first, in
 * the same lane across all their days (earliest and longest on top); single-day items fill
 * the free lanes under them. A day with more items than lanes gives its last lane to
 * "+N more", and any bar hidden that way is split around it.
 */
export function layoutMonthWeek(days: Date[], events: CalendarEvent[], lanes: number): MonthWeekLayout {
  const keys = days.map(dayKey);
  const rowStart = keys[0]!;
  const rowEnd = dayKey(addDays(days.at(-1)!, 1));
  const used: boolean[][] = days.map(() => []);

  // Bars ------------------------------------------------------------------
  const spans = events
    .filter((e) => isMultiDayAllDay(e) && e.start < rowEnd && e.end > rowStart)
    .map((e) => {
      const first = e.start <= rowStart ? 0 : keys.indexOf(e.start);
      let last = keys.length - 1;
      while (keys[last]! >= e.end) last--;
      return { event: e, first, last };
    })
    .sort(
      (a, b) =>
        a.first - b.first ||
        b.last - b.first - (a.last - a.first) ||
        a.event.start.localeCompare(b.event.start) ||
        a.event.title.localeCompare(b.event.title),
    );

  const placedBars = spans.map((s) => {
    let lane = 0;
    while (range(s.first, s.last).some((c) => used[c]![lane])) lane++;
    for (const c of range(s.first, s.last)) used[c]![lane] = true;
    return { ...s, lane };
  });

  // Single-day items -----------------------------------------------------
  const placedChips: MonthChip[] = [];
  days.forEach((day, col) => {
    for (const event of eventsForDay(events, day)) {
      if (isMultiDayAllDay(event)) continue;
      let lane = 0;
      while (used[col]![lane]) lane++;
      used[col]![lane] = true;
      placedChips.push({ event, col, lane });
    }
  });

  // Overflow --------------------------------------------------------------
  const cutoff = used.map((u) => (u.length > lanes ? Math.max(0, lanes - 1) : lanes));
  const hidden = days.map(() => 0);

  const chips = placedChips.filter((c) => {
    if (c.lane < cutoff[c.col]!) return true;
    hidden[c.col]!++;
    return false;
  });

  const bars: MonthBar[] = [];
  for (const b of placedBars) {
    let runStart = -1;
    for (let c = b.first; c <= b.last + 1; c++) {
      const visible = c <= b.last && b.lane < cutoff[c]!;
      if (c <= b.last && !visible) hidden[c]!++;
      if (visible && runStart === -1) runStart = c;
      if (!visible && runStart !== -1) {
        bars.push({
          event: b.event,
          col: runStart,
          span: c - runStart,
          lane: b.lane,
          startsHere: runStart === b.first && b.event.start >= rowStart,
          endsHere: c - 1 === b.last && b.event.end <= rowEnd,
        });
        runStart = -1;
      }
    }
  }

  const more = hidden.flatMap((count, col) => (count > 0 ? [{ col, lane: cutoff[col]!, count }] : []));
  return { bars, chips, more };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
