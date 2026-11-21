import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FeedStore, normalizeFeedUrl, type FetchLike } from '../src/server/ics/feeds.js';
import { mergeFeeds } from '../src/server/ics/merge.js';
import type { CalendarEvent } from '../src/shared/types.js';

const TZ = 'America/Chicago';
const range = { start: new Date('2026-10-26T05:00:00Z'), end: new Date('2026-11-09T06:00:00Z') };

const ics = (uid: string, summary: string, start: string, end: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${uid}
SUMMARY:${summary}
DTSTART:${start}
DTEND:${end}
END:VEVENT
END:VCALENDAR`;

const SCHOOL = ics('s1', 'Picture day', '20261027T140000Z', '20261027T150000Z');
const WORK = ics('w1', 'Standup', '20261027T130000Z', '20261027T133000Z');
const FAMILY = readFileSync('test/fixtures/family.ics', 'utf8');

function fakeFetch(routes: Record<string, string | number | Error>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (r instanceof Error) throw r;
    if (typeof r === 'number') return new Response('nope', { status: r });
    if (r === undefined) return new Response('not found', { status: 404 });
    return new Response(r, { status: 200 });
  };
  return Object.assign(fn, { calls });
}

const feeds = [
  { name: 'School', color: '#6B8E5A', url: 'https://x.test/school.ics' },
  { name: 'Work', color: '#7A5C8E', url: 'https://x.test/work.ics' },
  { name: 'Family', color: '#B5651D', url: 'webcal://x.test/family.ics' },
];

describe('mergeFeeds', () => {
  const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
    id: Math.random().toString(),
    feed: 'A',
    color: '#000000',
    title: 'x',
    allDay: false,
    start: '2026-10-27T15:00:00.000Z',
    end: '2026-10-27T16:00:00.000Z',
    ...over,
  });

  it('sorts by start, with all-day events first on the same day, then longer first', () => {
    const merged = mergeFeeds(
      [
        { status: { name: 'A', color: '#000000', ok: true, eventCount: 3 }, events: [
          ev({ title: 'late', start: '2026-10-27T20:00:00.000Z', end: '2026-10-27T21:00:00.000Z' }),
          ev({ title: 'short', start: '2026-10-27T15:00:00.000Z', end: '2026-10-27T15:30:00.000Z' }),
        ] },
        { status: { name: 'B', color: '#111111', ok: true, eventCount: 2 }, events: [
          ev({ title: 'long', feed: 'B' }),
          ev({ title: 'holiday', allDay: true, start: '2026-10-27', end: '2026-10-28', feed: 'B' }),
        ] },
      ],
      range,
      TZ,
    );
    expect(merged.events.map((e) => e.title)).toEqual(['holiday', 'long', 'short', 'late']);
    expect(merged.feeds.map((f) => f.name)).toEqual(['A', 'B']);
  });
});

describe('FeedStore', () => {
  it('merges events from several feeds, each tagged with its feed name and color', async () => {
    const fetch = fakeFetch({
      'https://x.test/school.ics': SCHOOL,
      'https://x.test/work.ics': WORK,
      'https://x.test/family.ics': FAMILY,
    });
    const store = new FeedStore({ feeds, timeZone: TZ, fetch });
    const res = await store.getEvents(range.start, range.end);

    expect(res.feeds.every((f) => f.ok)).toBe(true);
    const tuesday = res.events.filter((e) => e.start.startsWith('2026-10-27'));
    expect(tuesday.map((e) => [e.title, e.feed, e.color])).toEqual([
      ['Walk the dog', 'Family', '#B5651D'],
      ['Standup', 'Work', '#7A5C8E'],
      ['Picture day', 'School', '#6B8E5A'],
      ['Dentist', 'Family', '#B5651D'],
    ]);
    // webcal:// is fetched over https
    expect(fetch.calls).toContain('https://x.test/family.ics');
  });

  it('still returns other feeds when one fails, and reports the failure', async () => {
    const fetch = fakeFetch({
      'https://x.test/school.ics': SCHOOL,
      'https://x.test/work.ics': 500,
      'https://x.test/family.ics': new Error('getaddrinfo ENOTFOUND'),
    });
    const res = await new FeedStore({ feeds, timeZone: TZ, fetch }).getEvents(range.start, range.end);
    expect(res.events.map((e) => e.title)).toEqual(['Picture day']);
    expect(res.feeds).toEqual([
      expect.objectContaining({ name: 'School', ok: true, eventCount: 1 }),
      expect.objectContaining({ name: 'Work', ok: false, error: 'HTTP 500', eventCount: 0 }),
      expect.objectContaining({ name: 'Family', ok: false, error: 'getaddrinfo ENOTFOUND' }),
    ]);
  });

  it('rejects responses that are not calendars (e.g. a login page)', async () => {
    const fetch = fakeFetch({ 'https://x.test/school.ics': '<html>Sign in</html>' });
    const res = await new FeedStore({ feeds: [feeds[0]!], timeZone: TZ, fetch }).getEvents(range.start, range.end);
    expect(res.feeds[0]).toMatchObject({ ok: false, error: 'Response is not an ICS calendar' });
  });

  it('keeps showing the last good copy of a feed after it starts failing', async () => {
    let t = new Date('2026-10-27T12:00:00Z');
    const routes: Record<string, string | number> = { 'https://x.test/school.ics': SCHOOL };
    const store = new FeedStore({ feeds: [feeds[0]!], timeZone: TZ, fetch: fakeFetch(routes), now: () => t });

    await store.getEvents(range.start, range.end);
    routes['https://x.test/school.ics'] = 503;
    t = new Date('2026-10-27T12:05:00Z');
    const res = await store.getEvents(range.start, range.end);

    expect(res.events.map((e) => e.title)).toEqual(['Picture day']);
    expect(res.feeds[0]).toMatchObject({ ok: false, error: 'HTTP 503', lastSuccess: '2026-10-27T12:00:00.000Z' });
  });

  it('does not re-download a feed more than once per interval', async () => {
    let t = new Date('2026-10-27T12:00:00Z');
    const fetch = fakeFetch({ 'https://x.test/school.ics': SCHOOL });
    const store = new FeedStore({ feeds: [feeds[0]!], timeZone: TZ, fetch, now: () => t, minFetchIntervalMs: 60_000 });

    await Promise.all([store.getEvents(range.start, range.end), store.getEvents(range.start, range.end)]);
    t = new Date('2026-10-27T12:00:30Z');
    await store.getEvents(range.start, range.end);
    expect(fetch.calls).toHaveLength(1);

    t = new Date('2026-10-27T12:01:01Z');
    await store.getEvents(range.start, range.end);
    expect(fetch.calls).toHaveLength(2);
  });
});

describe('normalizeFeedUrl', () => {
  it('rewrites webcal and webcals to https', () => {
    expect(normalizeFeedUrl('webcal://a.test/x.ics')).toBe('https://a.test/x.ics');
    expect(normalizeFeedUrl('WEBCALS://a.test/x.ics')).toBe('https://a.test/x.ics');
    expect(normalizeFeedUrl('https://a.test/x.ics')).toBe('https://a.test/x.ics');
  });
});
