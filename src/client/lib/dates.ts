import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarEvent } from '../../shared/types';

export type View = 'week' | 'day' | 'month';

export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const first = startOfWeek(anchor, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** The weeks shown for the anchor's month: 4 to 6 rows of 7 days, padded with days from the months around it. */
export function monthWeeks(anchor: Date, weekStartsOn: 0 | 1): Date[][] {
  const first = startOfWeek(startOfMonth(anchor), { weekStartsOn });
  const last = endOfWeek(endOfMonth(anchor), { weekStartsOn });
  const weeks: Date[][] = [];
  for (let d = first; d <= last; d = addDays(d, 7)) weeks.push(weekDays(d, weekStartsOn));
  return weeks;
}

/** Local-time range [start, end) that the view displays. */
export function visibleRange(view: View, anchor: Date, weekStartsOn: 0 | 1): { start: Date; end: Date } {
  if (view === 'month') {
    const weeks = monthWeeks(anchor, weekStartsOn);
    return { start: weeks[0]![0]!, end: addDays(weeks.at(-1)![6]!, 1) };
  }
  if (view === 'day') {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  const start = startOfWeek(anchor, { weekStartsOn });
  return { start, end: addDays(start, 7) };
}

/**
 * Range to fetch. Day view fetches its whole week, so switching between week and day
 * needs no request. Month view fetches the full grid (at most 42 days).
 */
export function fetchRange(view: View, anchor: Date, weekStartsOn: 0 | 1): { start: Date; end: Date } {
  return visibleRange(view === 'month' ? 'month' : 'week', anchor, weekStartsOn);
}

export function step(view: View, anchor: Date, direction: 1 | -1): Date {
  if (view === 'month') return addMonths(anchor, direction);
  return addDays(anchor, (view === 'week' ? 7 : 1) * direction);
}

export function eventStart(e: CalendarEvent): Date {
  return e.allDay ? parseDateKey(e.start) : new Date(e.start);
}

export function eventEnd(e: CalendarEvent): Date {
  return e.allDay ? parseDateKey(e.end) : new Date(e.end);
}

/** "2026-11-21" → local midnight (not UTC midnight, which `new Date(str)` would give). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Events that touch the given local day, all-day first then by start time. */
export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = dayKey(day);
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return events
    .filter((e) => {
      if (e.allDay) return e.start <= key && key < e.end;
      const s = Date.parse(e.start);
      const en = Date.parse(e.end);
      return s < dayEnd && (en > dayStart || (s >= dayStart && en === s));
    })
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        eventStart(a).getTime() - eventStart(b).getTime() ||
        a.title.localeCompare(b.title),
    );
}

/** "4 pm", "4:30 pm" — short and readable from across the room. */
export function formatTime(d: Date): string {
  return format(d, d.getMinutes() === 0 ? 'h aaa' : 'h:mm aaa');
}

export function formatClock(d: Date): { time: string; period: string } {
  return { time: format(d, 'h:mm'), period: format(d, 'aaa') };
}

/**
 * Time label for an event as shown on a given day. `compact` drops the end time,
 * for narrow week-view columns.
 */
export function timeLabel(e: CalendarEvent, day: Date, compact = false): string {
  if (e.allDay) return 'All day';
  const s = eventStart(e);
  const en = eventEnd(e);
  const startsToday = isSameDay(s, day);
  const endsToday = isSameDay(en, day) || en.getTime() === addDays(startOfDay(day), 1).getTime();
  if (startsToday && endsToday) {
    return en.getTime() > s.getTime() && !compact ? `${formatTime(s)} – ${formatTime(en)}` : formatTime(s);
  }
  if (startsToday) return `From ${formatTime(s)}`;
  if (endsToday) return `Until ${formatTime(en)}`;
  return 'All day';
}

export function periodLabel(view: View, anchor: Date, weekStartsOn: 0 | 1): string {
  if (view === 'day') return format(anchor, 'EEEE, MMMM d');
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  const days = weekDays(anchor, weekStartsOn);
  const first = days[0]!;
  const last = days[6]!;
  if (first.getMonth() === last.getMonth()) return `${format(first, 'MMMM d')} – ${format(last, 'd')}`;
  if (first.getFullYear() === last.getFullYear()) return `${format(first, 'MMM d')} – ${format(last, 'MMM d')}`;
  return `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
}
