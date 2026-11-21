import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseConfig } from '../src/server/config.js';

describe('config', () => {
  it('accepts the committed example file', () => {
    const raw = JSON.parse(readFileSync('config.example.json', 'utf8'));
    const cfg = parseConfig(raw);
    expect(cfg.feeds.length).toBeGreaterThan(0);
  });

  it('applies defaults', () => {
    const cfg = parseConfig({
      location: { latitude: 1, longitude: 2 },
      feeds: [{ name: 'A', color: '#112233', url: 'https://x.test/a.ics' }],
    });
    expect(cfg.port).toBe(3000);
    expect(cfg.refreshMinutes).toBe(5);
    expect(cfg.weekStartsOn).toBe(0);
  });

  it('rejects bad colors and missing feeds with a readable message', () => {
    expect(() =>
      parseConfig({
        location: { latitude: 1, longitude: 2 },
        feeds: [{ name: 'A', color: 'orange', url: 'https://x.test/a.ics' }],
      }),
    ).toThrow(/hex color/);
    expect(() => parseConfig({ location: { latitude: 1, longitude: 2 }, feeds: [] })).toThrow(
      /at least one feed/,
    );
  });
});

describe('config feeds and zones', () => {
  const base = { location: { latitude: 1, longitude: 2 } };
  it('accepts webcal URLs and rejects other schemes', () => {
    expect(() =>
      parseConfig({ ...base, feeds: [{ name: 'A', color: '#112233', url: 'webcal://x.test/a.ics' }] }),
    ).not.toThrow();
    expect(() =>
      parseConfig({ ...base, feeds: [{ name: 'A', color: '#112233', url: 'ftp://x.test/a.ics' }] }),
    ).toThrow(/webcal/);
  });

  it('validates timeZone', () => {
    const feeds = [{ name: 'A', color: '#112233', url: 'https://x.test/a.ics' }];
    expect(parseConfig({ ...base, feeds, timeZone: 'America/Chicago' }).timeZone).toBe('America/Chicago');
    expect(() => parseConfig({ ...base, feeds, timeZone: 'Mars/Olympus' })).toThrow(/IANA/);
  });
});
