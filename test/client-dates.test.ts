import { describe, expect, it } from 'vitest';
import { eventsForDay, formatTime, periodLabel, timeLabel, weekDays } from '../src/client/lib/dates.js';
import { layoutDay } from '../src/client/lib/dayLayout.js';
import type { CalendarEvent } from '../src/shared/types.js';

// vitest.config sets TZ=America/Chicago so these local-time assertions are stable.
const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.random().toString(),
  feed: 'F',
  color: '#000000',
  title: 'x',
  allDay: false,
  start: '2026-11-21T15:00:00.000Z',
  end: '2026-11-21T16:00:00.000Z',
  ...over,
});
const sat = new Date(2026, 10, 21);

describe('client date helpers', () => {
  it('builds a week starting on Sunday or Monday', () => {
    expect(weekDays(sat, 0)[0]!.getDate()).toBe(15);
    expect(weekDays(sat, 1)[0]!.getDate()).toBe(16);
  });

  it('places events on local days, including multi-day all-day and overnight events', () => {
    const events = [
      ev({ title: 'trip', allDay: true, start: '2026-11-20', end: '2026-11-23' }),
      ev({ title: 'late show', start: '2026-11-22T04:00:00.000Z', end: '2026-11-22T07:00:00.000Z' }), // Sat 10pm–Sun 1am
      ev({ title: 'yesterday', allDay: true, start: '2026-11-20', end: '2026-11-21' }),
      ev({ title: 'morning', start: '2026-11-21T14:00:00.000Z', end: '2026-11-21T15:00:00.000Z' }),
    ];
    expect(eventsForDay(events, sat).map((e) => e.title)).toEqual(['trip', 'morning', 'late show']);
    const sun = new Date(2026, 10, 22);
    expect(eventsForDay(events, sun).map((e) => e.title)).toEqual(['trip', 'late show']);
    expect(timeLabel(events[1]!, sun)).toBe('Until 1 am');
    expect(timeLabel(events[1]!, sat)).toBe('From 10 pm');
  });

  it('drops the end time in compact mode', () => {
    const e = ev({ start: '2026-11-21T15:00:00.000Z', end: '2026-11-21T15:30:00.000Z' });
    expect(timeLabel(e, sat)).toBe('9 am – 9:30 am');
    expect(timeLabel(e, sat, true)).toBe('9 am');
  });

  it('formats times compactly', () => {
    expect(formatTime(new Date(2026, 0, 1, 16, 0))).toBe('4 pm');
    expect(formatTime(new Date(2026, 0, 1, 9, 30))).toBe('9:30 am');
  });

  it('labels a week that crosses months', () => {
    expect(periodLabel('week', new Date(2026, 10, 30), 0)).toBe('Nov 29 – Dec 5');
    expect(periodLabel('week', sat, 0)).toBe('November 15 – 21');
  });
});

describe('layoutDay', () => {
  const ws = new Date(2026, 10, 21, 7);
  const we = new Date(2026, 10, 21, 21);
  it('splits out all-day and out-of-hours events', () => {
    const r = layoutDay(
      [
        ev({ title: 'allday', allDay: true, start: '2026-11-21', end: '2026-11-22' }),
        ev({ title: 'early', start: '2026-11-21T11:00:00.000Z', end: '2026-11-21T11:30:00.000Z' }), // 5am
        ev({ title: 'late', start: '2026-11-22T04:00:00.000Z', end: '2026-11-22T05:00:00.000Z' }), // 10pm
        ev({ title: 'in', start: '2026-11-21T15:00:00.000Z', end: '2026-11-21T16:00:00.000Z' }), // 9am
      ],
      ws,
      we,
    );
    expect(r.allDay.map((e) => e.title)).toEqual(['allday']);
    expect(r.earlier.map((e) => e.title)).toEqual(['early']);
    expect(r.later.map((e) => e.title)).toEqual(['late']);
    expect(r.placed).toHaveLength(1);
    expect(r.placed[0]!.top).toBeCloseTo(2 / 14);
    expect(r.placed[0]!.height).toBeCloseTo(1 / 14);
  });

  it('puts overlapping events side by side and leaves others full width', () => {
    const r = layoutDay(
      [
        ev({ title: 'a', start: '2026-11-21T15:00:00.000Z', end: '2026-11-21T17:00:00.000Z' }),
        ev({ title: 'b', start: '2026-11-21T16:00:00.000Z', end: '2026-11-21T17:00:00.000Z' }),
        ev({ title: 'c', start: '2026-11-21T19:00:00.000Z', end: '2026-11-21T20:00:00.000Z' }),
      ],
      ws,
      we,
    );
    const by = Object.fromEntries(r.placed.map((p) => [p.event.title, p]));
    expect([by.a!.left, by.a!.width]).toEqual([0, 0.5]);
    expect([by.b!.left, by.b!.width]).toEqual([0.5, 0.5]);
    expect([by.c!.left, by.c!.width]).toEqual([0, 1]);
  });
});
