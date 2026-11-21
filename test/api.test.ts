import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server/app.js';
import { parseConfig } from '../src/server/config.js';
import type { FetchLike } from '../src/server/ics/feeds.js';
import { describeWeatherCode, parseOpenMeteo } from '../src/server/weather.js';

const config = parseConfig({
  location: { name: 'Home', latitude: 44.98, longitude: -93.27 },
  timeZone: 'America/Chicago',
  feeds: [{ name: 'School', color: '#6B8E5A', url: 'https://x.test/school.ics' }],
});

const SCHOOL = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:s1
SUMMARY:Picture day
DTSTART:20261027T140000Z
DTEND:20261027T150000Z
END:VEVENT
END:VCALENDAR`;

const METEO = {
  current: { temperature_2m: 41.6, weather_code: 3, is_day: 1 },
  daily: { temperature_2m_max: [47.2], temperature_2m_min: [33.9] },
};

const fetch: FetchLike = async (url) =>
  url.startsWith('https://api.open-meteo.com')
    ? Response.json(METEO)
    : new Response(SCHOOL, { status: 200 });

const clientDir = mkdtempSync(join(tmpdir(), 'pits-client-'));
writeFileSync(join(clientDir, 'index.html'), '<!doctype html><title>cal</title>');
const app = await buildApp(config, { fetch, clientDir });
afterAll(() => app.close());

describe('API', () => {
  it('GET /api/settings exposes display settings but not feed URLs', async () => {
    const res = await app.inject('/api/settings');
    expect(res.json()).toMatchObject({ weekStartsOn: 0, refreshMinutes: 5, feeds: [{ name: 'School', color: '#6B8E5A' }] });
    expect(res.body).not.toContain('x.test');
  });

  it('GET /api/events returns merged events for the range', async () => {
    const res = await app.inject('/api/events?start=2026-10-26T05:00:00Z&end=2026-11-02T06:00:00Z');
    expect(res.statusCode).toBe(200);
    expect(res.json().events).toEqual([expect.objectContaining({ title: 'Picture day', feed: 'School' })]);
  });

  it('GET /api/events validates the range', async () => {
    expect((await app.inject('/api/events?start=nope&end=2026-11-02')).statusCode).toBe(400);
    expect((await app.inject('/api/events?start=2026-01-01&end=2026-12-01')).statusCode).toBe(400);
  });

  it('GET /api/weather returns current conditions', async () => {
    const res = await app.inject('/api/weather');
    expect(res.json()).toMatchObject({ temperature: 42, unit: 'F', description: 'Overcast', high: 47, low: 34 });
  });

  it('serves the client app for non-API routes and 404s unknown API routes', async () => {
    expect((await app.inject('/')).body).toContain('<title>cal</title>');
    expect((await app.inject('/some/route')).body).toContain('<title>cal</title>');
    expect((await app.inject('/api/nope')).statusCode).toBe(404);
    expect((await app.inject('/assets/missing-abc123.js')).statusCode).toBe(404);
  });
});

describe('weather parsing', () => {
  it('maps WMO codes and units', () => {
    expect(describeWeatherCode(73)).toBe('Snow');
    expect(describeWeatherCode(1234)).toBe('Unknown');
    const w = parseOpenMeteo(METEO, 'celsius', new Date(0));
    expect(w.unit).toBe('C');
  });

  it('rejects malformed responses', () => {
    expect(() => parseOpenMeteo({}, 'fahrenheit', new Date())).toThrow();
  });
});
