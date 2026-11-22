import { describe, expect, it } from 'vitest';
import { cssVar, feedColors, isNightHour, personColors, isThemeName, THEME_NAMES, THEMES } from '../src/shared/themes.js';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('themes', () => {
  // Read from across the room, so text needs more than the usual minimums.
  it.each(THEME_NAMES)('%s is readable', (name) => {
    const p = THEMES[name].palette;
    expect(contrast(p.umber, p.birch)).toBeGreaterThanOrEqual(9);
    expect(contrast(p.umber, p.lichen)).toBeGreaterThanOrEqual(8);
    expect(contrast(p.bark, p.birch)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.moss, p.birch)).toBeGreaterThanOrEqual(4.3);
    expect(contrast(p.onMoss, p.moss)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.warn, p.birch)).toBeGreaterThanOrEqual(4.3);
  });

  it.each(THEME_NAMES)('%s calendar colors take light text and are distinct', (name) => {
    const list: string[] = (THEMES[name] as { calendars?: string[] }).calendars ?? [];
    for (const c of list) expect(contrast(c, THEMES[name].palette.onFill)).toBeGreaterThanOrEqual(4.5);
    expect(new Set(list).size).toBe(list.length);
  });

  it('gives feeds theme colors in config order, falling back to config', () => {
    const config = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
    expect(feedColors('autumn', config)).toEqual(config);
    expect(feedColors('night', config)).toEqual(config);
    expect(feedColors('fruit', config)).toEqual(['#ae4036', '#706f81', '#816e3f', '#4f5945', '#946560', '#666666']);
  });

  it('gives people the theme colors after the feeds', () => {
    expect(personColors('fruit', 2, ['#111111', '#222222', '#333333', '#444444'])).toEqual([
      '#816e3f',
      '#4f5945',
      '#946560',
      '#444444',
    ]);
    expect(personColors('autumn', 2, ['#111111'])).toEqual(['#111111']);
  });

  it('marks only night as dark', () => {
    expect(THEME_NAMES.filter((n) => THEMES[n].dark)).toEqual(['night']);
  });

  it('names CSS variables after palette keys', () => {
    expect(cssVar('lichen')).toBe('--lichen');
    expect(cssVar('onMoss')).toBe('--on-moss');
  });

  it('validates theme names', () => {
    expect(isThemeName('garden')).toBe(true);
    expect(isThemeName('toString')).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });
});

describe('isNightHour', () => {
  const at = (h: number) => new Date(2026, 10, 22, h, 30);
  it('wraps past midnight', () => {
    expect([20, 21, 23, 0, 5, 6].map((h) => isNightHour(at(h), 21, 6))).toEqual([false, true, true, true, true, false]);
  });
  it('handles a window within one day', () => {
    expect([0, 1, 4, 5].map((h) => isNightHour(at(h), 1, 5))).toEqual([false, true, true, false]);
  });
});
