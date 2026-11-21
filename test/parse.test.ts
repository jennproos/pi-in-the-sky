import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIcs, type ParseOptions } from '../src/server/ics/parse.js';
import type { CalendarEvent } from '../src/shared/types.js';

const fixture = (name: string) => readFileSync(`test/fixtures/${name}`, 'utf8');

// Mon 26 Oct 2026 00:00 CDT → Mon 9 Nov 2026 00:00 CST (spans the 1 Nov DST change).
const opts: ParseOptions = {
  feedName: 'Family',
  color: '#B5651D',
  rangeStart: new Date('2026-10-26T05:00:00Z'),
  rangeEnd: new Date('2026-11-09T06:00:00Z'),
  timeZone: 'America/Chicago',
};

const byTitle = (events: CalendarEvent[], title: string) =>
  events.filter((e) => e.title === title).sort((a, b) => a.start.localeCompare(b.start));

describe('parseIcs: single events', () => {
  const events = parseIcs(fixture('family.ics'), opts);

  it('parses a UTC event and tags it with the feed name and color', () => {
    const [dentist] = byTitle(events, 'Dentist');
    expect(dentist).toMatchObject({
      start: '2026-10-27T15:00:00.000Z',
      end: '2026-10-27T16:00:00.000Z',
      allDay: false,
      feed: 'Family',
      color: '#B5651D',
    });
  });

  it('keeps all-day events as dates with an exclusive end', () => {
    const [fallBreak] = byTitle(events, 'Fall break');
    expect(fallBreak).toMatchObject({ allDay: true, start: '2026-10-29', end: '2026-10-31' });
  });

  it('skips events with STATUS:CANCELLED', () => {
    expect(byTitle(events, 'Cancelled party')).toHaveLength(0);
  });

  it('includes LOCATION when present', () => {
    expect(byTitle(events, 'Soccer practice')[0]?.location).toBe('Lake Park Field 3');
  });

  it('throws on text that is not a calendar', () => {
    expect(() => parseIcs('<html>Sign in</html>', opts)).toThrow();
  });
});

describe('parseIcs: recurring events', () => {
  const events = parseIcs(fixture('family.ics'), opts);

  it('expands a weekly BYDAY rule, honouring EXDATE and cancelled overrides', () => {
    const soccer = byTitle(events, 'Soccer practice').map((e) => e.start);
    // Mon 26 Oct (CDT), [Wed 28 Oct EXDATE], [Mon 2 Nov overridden], [Wed 4 Nov cancelled]
    expect(soccer).toEqual(['2026-10-26T22:30:00.000Z']);
  });

  it('applies a RECURRENCE-ID override that moves an occurrence', () => {
    const late = byTitle(events, 'Soccer practice (late)');
    expect(late).toHaveLength(1);
    // 18:00 CST
    expect(late[0]?.start).toBe('2026-11-03T00:00:00.000Z');
  });

  it('stops a COUNT-limited rule after its last occurrence', () => {
    const piano = byTitle(events, 'Piano lesson').map((e) => e.start);
    // 8th and final lesson is Thu 29 Oct; nothing on 5 Nov.
    expect(piano).toEqual(['2026-10-29T21:00:00.000Z']);
  });

  it('expands a long-running daily rule and keeps local time across DST', () => {
    const walks = byTitle(events, 'Walk the dog');
    expect(walks).toHaveLength(14);
    const sat = walks.find((e) => e.start.startsWith('2026-10-31'));
    const mon = walks.find((e) => e.start.startsWith('2026-11-02'));
    expect(sat?.start).toBe('2026-10-31T12:00:00.000Z'); // 07:00 CDT
    expect(mon?.start).toBe('2026-11-02T13:00:00.000Z'); // 07:00 CST
  });

  it('expands yearly all-day events from decades ago', () => {
    const wide = { ...opts, rangeStart: new Date('2027-01-01T06:00:00Z'), rangeEnd: new Date('2027-01-31T06:00:00Z') };
    const bday = byTitle(parseIcs(fixture('family.ics'), wide), "Grandma's birthday");
    expect(bday).toEqual([expect.objectContaining({ allDay: true, start: '2027-01-05', end: '2027-01-06' })]);
  });

  it('gives each occurrence a unique id', () => {
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseIcs: time zones', () => {
  const events = parseIcs(fixture('outlook-no-vtimezone.ics'), opts);

  it('resolves an IANA TZID even when the feed omits VTIMEZONE', () => {
    expect(byTitle(events, 'Call with Aunt Jo')[0]?.start).toBe('2026-10-27T13:00:00.000Z');
  });

  it('maps Windows zone names to IANA zones', () => {
    expect(byTitle(events, 'Parent-teacher conference')[0]?.start).toBe('2026-11-03T14:00:00.000Z');
  });

  it('treats floating times as the configured local zone', () => {
    expect(byTitle(events, 'Lunch')[0]?.start).toBe('2026-10-28T17:00:00.000Z');
  });

  it('expands recurrences in a zone without VTIMEZONE across DST', () => {
    expect(byTitle(events, 'Choir').map((e) => e.start)).toEqual([
      '2026-10-30T12:00:00.000Z',
      '2026-11-06T13:00:00.000Z',
    ]);
  });

  it('does not let one feed’s VTIMEZONE leak into another', async () => {
    const ICAL = (await import('ical.js')).default;
    parseIcs(fixture('family.ics'), opts);
    expect(ICAL.TimezoneService.has('America/Chicago')).toBe(false);
  });
});
