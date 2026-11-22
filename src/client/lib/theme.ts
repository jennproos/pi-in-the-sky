import { cssVar, DEFAULT_THEME, isThemeName, THEMES, type Palette, type ThemeName } from '../../shared/themes';

const LAST_THEME_KEY = 'pits-last-theme';

/** The palette as CSS custom properties, for `style` or the root element. */
export function paletteVars(name: ThemeName): Record<string, string> {
  const p = THEMES[name].palette;
  return Object.fromEntries((Object.keys(p) as (keyof Palette)[]).map((k) => [cssVar(k), p[k]]));
}

/** Put a theme's colors on <html>, where every token is read from. */
export function applyTheme(name: ThemeName): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(paletteVars(name))) root.style.setProperty(k, v);
  root.style.colorScheme = THEMES[name].dark ? 'dark' : 'light';
  root.style.setProperty('--fill-strength', THEMES[name].dark ? '75%' : '100%');
  root.dataset.theme = name;
  try {
    localStorage.setItem(LAST_THEME_KEY, name);
  } catch {
    // Storage unavailable: the next load just starts on the default colors.
  }
}

/** The theme shown last time, so a reload at night doesn't flash a light page. */
export function lastTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(LAST_THEME_KEY);
    return isThemeName(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 21 → "9 pm", 0 → "midnight". */
export function formatHour(h: number): string {
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return `${h % 12} ${h < 12 ? 'am' : 'pm'}`;
}
