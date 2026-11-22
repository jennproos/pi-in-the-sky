/**
 * Color themes. Each one fills in the color tokens the stylesheet uses (see
 * src/client/styles/tokens.css for what each token is for). Shared so the server can
 * validate theme names and the tests can check contrast.
 */

export interface Palette {
  /** Page background. */
  lichen: string;
  /** Day columns, cards, sheets. */
  birch: string;
  /** Ink. */
  umber: string;
  /** Secondary ink. */
  bark: string;
  /** Today. */
  ochre: string;
  /** Controls. */
  moss: string;
  /** Text on a moss-filled control. */
  onMoss: string;
  /** Text on feed, person and warn fills. */
  onFill: string;
  /** Text inputs and keyboard keys. */
  field: string;
  /** Behind a sheet. */
  scrim: string;
  line: string;
  warn: string;
}

export interface Theme {
  label: string;
  dark: boolean;
  palette: Palette;
  /**
   * Calendar colors, given to feeds in config order, then to to-do people. Deep enough for light text on an
   * all-day event. Without a list (or past its end) a feed or person keeps its color from config.
   */
  calendars?: string[];
}

const CREAM = '#fbf8f1';
const FIELD = '#fbf9f4';

/** Light themes share these; only the main colors differ. */
function light(p: Omit<Palette, 'onMoss' | 'onFill' | 'field' | 'scrim'>): Palette {
  return { ...p, onMoss: CREAM, onFill: CREAM, field: FIELD, scrim: 'rgb(47 42 36 / 0.45)' };
}

export const THEMES = {
  autumn: {
    label: 'Autumn',
    dark: false,
    palette: light({
      lichen: '#d9d6c7',
      birch: '#ece9df',
      umber: '#2f2a24',
      bark: '#6b6256',
      ochre: '#b8862f',
      moss: '#5f6b4e',
      line: '#c4bfae',
      warn: '#a5561f',
    }),
  },
  // The next seven are sampled from the Emily Lex watercolor workbook covers (issue #3).
  // Their calendar colors come from the same swatches, darkened where needed for light text.
  baking: {
    label: 'Baking',
    dark: false,
    calendars: ['#b9433e', '#4a6680', '#91693b', '#5b7674', '#7d5c46', '#826c62'],
    palette: light({
      lichen: '#e1d1cb',
      birch: '#f2e9e5',
      umber: '#1d3845',
      bark: '#45606e',
      ochre: '#b9433e',
      moss: '#4a6680',
      line: '#c9b8b0',
      warn: '#8f2f27',
    }),
  },
  camping: {
    label: 'Camping',
    dark: false,
    calendars: ['#af5745', '#767144', '#99642a', '#504828', '#785d4a'],
    palette: light({
      lichen: '#dbd4c5',
      birch: '#efeae2',
      umber: '#482e26',
      bark: '#73564d',
      ochre: '#b17c45',
      moss: '#64673c',
      line: '#c3bbaa',
      warn: '#b94031',
    }),
  },
  birds: {
    label: 'Birds',
    dark: false,
    calendars: ['#936838', '#49768c', '#74751c', '#94542d', '#75715e', '#473f19'],
    palette: light({
      lichen: '#d7d5c8',
      birch: '#edebe4',
      umber: '#3c350f',
      bark: '#675d35',
      ochre: '#958647',
      moss: '#717123',
      line: '#bfbcad',
      warn: '#94542d',
    }),
  },
  fruit: {
    label: 'Fruit',
    dark: false,
    calendars: ['#ae4036', '#706f81', '#816e3f', '#4f5945', '#946560'],
    palette: light({
      lichen: '#d8d4c7',
      birch: '#edebe3',
      umber: '#2e3825',
      bark: '#55604b',
      ochre: '#b04137',
      moss: '#444b22',
      line: '#c0bbac',
      warn: '#8a2e26',
    }),
  },
  garden: {
    label: 'Garden',
    dark: false,
    calendars: ['#803f1c', '#6a7718', '#886c00', '#555b2a', '#7d6f5d', '#6e5641', '#322d18'],
    palette: light({
      lichen: '#ddd3c7',
      birch: '#f0eae3',
      umber: '#322d18',
      bark: '#645d46',
      ochre: '#a78121',
      moss: '#5d7223',
      line: '#c5baac',
      warn: '#803f1c',
    }),
  },
  bouquets: {
    label: 'Bouquets',
    dark: false,
    calendars: ['#a65b64', '#586b74', '#5e7923', '#8c222a', '#816f3a', '#775639', '#454528', '#1a2833'],
    palette: light({
      lichen: '#dcd3c9',
      birch: '#f0eae4',
      umber: '#1a2833',
      bark: '#505e6b',
      ochre: '#b8727d',
      moss: '#4c5518',
      line: '#c4baaf',
      warn: '#92333b',
    }),
  },
  woodland: {
    label: 'Woodland',
    dark: false,
    calendars: ['#8e3726', '#807015', '#906568', '#9e6235', '#544530', '#704e2e', '#856d50'],
    palette: light({
      lichen: '#dad4c6',
      birch: '#eeebe2',
      umber: '#3c341f',
      bark: '#665c45',
      ochre: '#b5774b',
      moss: '#6d672a',
      line: '#c1bbab',
      warn: '#8e3726',
    }),
  },
  /** Dim and warm, so the wall doesn't light up the room at night. */
  night: {
    label: 'Night',
    dark: true,
    palette: {
      lichen: '#12110e',
      birch: '#1e1b17',
      umber: '#cbc2b0',
      bark: '#958b79',
      ochre: '#c29447',
      moss: '#8e9a72',
      onMoss: '#12110e',
      onFill: '#f1ebdf',
      field: '#2a2620',
      scrim: 'rgb(0 0 0 / 0.6)',
      line: '#36312a',
      warn: '#d0844e',
    },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const DEFAULT_THEME: ThemeName = 'autumn';

/**
 * Each feed's color under a theme, in config order. Autumn (the palette the config colors
 * were picked for) and Night keep the config colors.
 */
export function feedColors(theme: ThemeName, configColors: string[]): string[] {
  return themeColors(theme, configColors, 0);
}

/**
 * Each to-do person's color under a theme. People take the colors after the feeds' so a
 * person never matches a calendar; past the end of the list they keep their config color.
 */
export function personColors(theme: ThemeName, feedCount: number, configColors: string[]): string[] {
  return themeColors(theme, configColors, feedCount);
}

function themeColors(theme: ThemeName, configColors: string[], offset: number): string[] {
  const list: string[] = (THEMES[theme] as Theme).calendars ?? [];
  return configColors.map((c, i) => list[offset + i] ?? c);
}

export function isThemeName(name: unknown): name is ThemeName {
  return typeof name === 'string' && Object.hasOwn(THEMES, name);
}

/** CSS custom property for each palette key, e.g. onMoss → --on-moss. */
export function cssVar(key: keyof Palette): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Whether `now` falls in the night window. Hours wrap past midnight (e.g. 21 → 6). */
export function isNightHour(now: Date, fromHour: number, toHour: number): boolean {
  const h = now.getHours();
  if (fromHour === toHour) return false;
  return fromHour < toHour ? h >= fromHour && h < toHour : h >= fromHour || h < toHour;
}
