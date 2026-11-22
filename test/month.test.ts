import { describe, expect, it } from 'vitest';
import { dayKey, fetchRange, monthWeeks, periodLabel, step, visibleRange } from '../src/client/lib/dates.js';
import { isMultiDayAllDay, layoutMonthWeek } from '../src/client/lib/monthLayout.js';
import type { CalendarEvent } from '../src/shared/types.js';

// vitest.config sets TZ=America/Chicago so these local-time assertions are stable.
const bounds = (y: number, m: number, ws: 0 | 1) => {
  const weeks = monthWeeks(new Date(y, m - 1, 15), ws);
  return [weeks.length, dayKey(weeks[0]![0]!), dayKey(weeks.at(-1)![6]!)];
};

describe('month grid', () => {
  it('pads a month starting on Sunday to whole weeks for either week start', () => {
    // November 2026 starts on a Sunday.
    expect(bounds(2026, 11, 0)).toEqual([5, '2026-11-01', '2026-12-05']);
    expect(bounds(2026, 11, 1)).toEqual([6, '2026-10-26', '2026-12-06']);
  });

  it('handles February, including one that fits in four rows', () => {
    expect(bounds(2026, 2, 0)).toEqual([4, '2026-02-01', '2026-02-28']);
    expect(bounds(2026, 2, 1)).toEqual([5, '2026-01-26', '2026-03-01']);
    expect(bounds(2027, 2, 1)).toEqual([4, '2027-02-01', '2027-02-28']);
  });

  it('uses six rows when the month needs them', () => {
    expect(bounds(2026, 8, 0)).toEqual([6, '2026-07-26', '2026-09-05']);
  });

  it('fetches the whole grid, within the server limit', () => {
    const r = fetchRange('month', new Date(2026, 7, 15), 0);
    expect([dayKey(r.start), dayKey(r.end)]).toEqual(['2026-07-26', '2026-09-06']);
    expect(r).toEqual(visibleRange('month', new Date(2026, 7, 15), 0));
    // Week and day views still fetch the week.
    expect(dayKey(fetchRange('day', new Date(2026, 10, 21), 0).start)).toBe('2026-11-15');
  });

  it('steps by a month and labels it', () => {
    expect(dayKey(step('month', new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(dayKey(step('month', new Date(2026, 0, 15), -1))).toBe('2025-12-15');
    expect(periodLabel('month', new Date(2026, 10, 21), 0)).toBe('November 2026');
  });
});

let id = 0;
const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: String(id++),
  feed: 'F',
  color: '#000000',
  title: 'x',
  allDay: true,
  start: '2026-11-16',
  end: '2026-11-17',
  ...over,
});
// Sun Nov 15 – Sat Nov 21, 2026.
const week = monthWeeks(new Date(2026, 10, 15), 0)[2]!;
const timed = (title: string, day: number, hourUtc = 15): CalendarEvent =>
  ev({
    title,
    allDay: false,
    start: `2026-11-${day}T${hourUtc}:00:00.000Z`,
    end: `2026-11-${day}T${hourUtc + 1}:00:00.000Z`,
  });

describe('layoutMonthWeek', () => {
  it('knows which events are bars', () => {
    expect(isMultiDayAllDay(ev({}))).toBe(false);
    expect(isMultiDayAllDay(ev({ end: '2026-11-18' }))).toBe(true);
    expect(isMultiDayAllDay(timed('t', 16))).toBe(false);
  });

  it('draws a multi-day event as one bar and fills lanes under it', () => {
    const trip = ev({ title: 'trip', start: '2026-11-17', end: '2026-11-20' }); // Tue–Thu
    const { bars, chips, more } = layoutMonthWeek(week, [trip, timed('dentist', 18), timed('gym', 16)], 3);
    expect(bars).toEqual([{ event: trip, col: 2, span: 3, lane: 0, startsHere: true, endsHere: true }]);
    expect(chips.map((c) => [c.event.title, c.col, c.lane])).toEqual([
      ['gym', 1, 0],
      ['dentist', 3, 1],
    ]);
    expect(more).toEqual([]);
  });

  it('marks bars that continue from or into another week', () => {
    const breakWeek = ev({ title: 'break', start: '2026-11-12', end: '2026-11-25' });
    const [bar] = layoutMonthWeek(week, [breakWeek], 3).bars;
    expect(bar).toMatchObject({ col: 0, span: 7, startsHere: false, endsHere: false });
  });

  it('puts earlier and longer bars on top', () => {
    const short = ev({ title: 'short', start: '2026-11-17', end: '2026-11-19' });
    const long = ev({ title: 'long', start: '2026-11-17', end: '2026-11-21' });
    const early = ev({ title: 'early', start: '2026-11-15', end: '2026-11-17' });
    const lanes = layoutMonthWeek(week, [short, long, early], 4).bars.map((b) => [b.event.title, b.lane]);
    expect(lanes).toEqual([
      ['early', 0],
      ['long', 0],
      ['short', 1],
    ]);
  });

  it('gives the last lane to "+N more" on a full day and splits a bar around it', () => {
    const trip = ev({ title: 'trip', start: '2026-11-16', end: '2026-11-19' }); // Mon–Wed
    const tuesday = [timed('a', 17, 14), timed('b', 17, 15), timed('c', 17, 16)];
    const { bars, chips, more } = layoutMonthWeek(week, [trip, ev({ title: 'visit', start: '2026-11-16', end: '2026-11-19' }), ...tuesday], 3);
    // Tuesday needs 5 lanes but has 3: two items show, then "+3 more".
    expect(more).toEqual([{ col: 2, lane: 2, count: 3 }]);
    expect(chips.filter((c) => c.col === 2)).toHaveLength(0);
    expect(bars.map((b) => [b.event.title, b.col, b.span])).toEqual([
      ['trip', 1, 3],
      ['visit', 1, 3],
    ]);

    // With only 2 lanes, the second bar is hidden on Tuesday but shows on Monday and Wednesday.
    const tight = layoutMonthWeek(week, [trip, ev({ title: 'visit', start: '2026-11-16', end: '2026-11-19' }), ...tuesday], 2);
    expect(tight.bars.map((b) => [b.event.title, b.col, b.span, b.startsHere, b.endsHere])).toEqual([
      ['trip', 1, 3, true, true],
      ['visit', 1, 1, true, false],
      ['visit', 3, 1, false, true],
    ]);
    expect(tight.more).toEqual([{ col: 2, lane: 1, count: 4 }]);
  });
});
