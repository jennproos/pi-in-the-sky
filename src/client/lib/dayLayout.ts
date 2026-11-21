import type { CalendarEvent } from '../../shared/types';

export interface PlacedEvent {
  event: CalendarEvent;
  /** Fractions of the visible window, 0..1. */
  top: number;
  height: number;
  /** Fractions of the column width, 0..1. */
  left: number;
  width: number;
}

export interface DaySplit {
  placed: PlacedEvent[];
  /** All-day events and timed events entirely outside the visible hours. */
  allDay: CalendarEvent[];
  earlier: CalendarEvent[];
  later: CalendarEvent[];
}

/**
 * Lay out a day's timed events in the [windowStart, windowEnd) hours.
 * Overlapping events share the width side by side. `minDurationMs` gives short
 * events enough room for a line of text, and counts toward overlap detection.
 */
export function layoutDay(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  minDurationMs = 45 * 60_000,
): DaySplit {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const span = we - ws;
  const split: DaySplit = { placed: [], allDay: [], earlier: [], later: [] };

  const items: { event: CalendarEvent; s: number; e: number }[] = [];
  for (const event of events) {
    if (event.allDay) {
      split.allDay.push(event);
      continue;
    }
    const s = Date.parse(event.start);
    const e = Math.max(Date.parse(event.end), s);
    if (e <= ws && s < ws) split.earlier.push(event);
    else if (s >= we) split.later.push(event);
    else {
      const cs = Math.max(s, ws);
      const ce = Math.min(Math.max(e, cs + minDurationMs), we);
      items.push({ event, s: cs, e: Math.max(ce, Math.min(cs + minDurationMs, we)) });
    }
  }
  items.sort((a, b) => a.s - b.s || b.e - a.e);

  // Group into clusters of transitively-overlapping events, then assign columns.
  let cluster: { item: (typeof items)[number]; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const cols = colEnds.length;
    for (const { item, col } of cluster) {
      split.placed.push({
        event: item.event,
        top: (item.s - ws) / span,
        height: (item.e - item.s) / span,
        left: col / cols,
        width: 1 / cols,
      });
    }
    cluster = [];
    colEnds = [];
  };

  for (const item of items) {
    if (item.s >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((end) => end <= item.s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.e);
    } else {
      colEnds[col] = item.e;
    }
    cluster.push({ item, col });
    clusterEnd = cluster.length === 1 ? item.e : Math.max(clusterEnd, item.e);
  }
  if (cluster.length) flush();

  return split;
}
