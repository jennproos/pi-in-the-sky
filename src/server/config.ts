import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { DEFAULT_THEME, feedColors, personColors, THEME_NAMES } from '../shared/themes.js';
import { isValidTimeZone, systemTimeZone } from './ics/timezone.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #B5651D');

export const configSchema = z
  .object({
    port: z.number().int().positive().default(3000),
    location: z.object({
      name: z.string().default('Home'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    /** IANA zone for floating times and all-day dates. Defaults to the system zone. */
    timeZone: z
      .string()
      .refine(isValidTimeZone, 'must be an IANA time zone like America/Chicago')
      .default(() => systemTimeZone()),
    units: z.enum(['fahrenheit', 'celsius']).default('fahrenheit'),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(0),
    dayStartHour: z.number().int().min(0).max(23).default(7),
    dayEndHour: z.number().int().min(1).max(24).default(21),
    refreshMinutes: z.number().positive().default(5),
    feeds: z
      .array(
        z.object({
          name: z.string().min(1),
          /** Optional; overrides the theme's color for this calendar in every theme. */
          color: hexColor.optional(),
          url: z.string().regex(/^(https?|webcals?):\/\/\S+$/i, 'must be an http(s) or webcal URL'),
        }),
      )
      .min(1, 'add at least one feed'),
    /** People to-do items can be assigned to. */
    people: z
      .array(z.object({ name: z.string().trim().min(1).max(30), color: hexColor.optional() }))
      .max(8)
      .default([])
      .refine((ps) => new Set(ps.map((p) => p.name.toLowerCase())).size === ps.length, 'people names must be unique'),
    /** Starting color theme. It can be changed from the wall, which remembers the choice. */
    theme: z.enum(THEME_NAMES).default(DEFAULT_THEME),
    /**
     * Switch to the dark night theme between these hours (wrapping past midnight), so the
     * wall doesn't light up the room. It can be turned off from the wall, or here with false.
     */
    nightMode: z
      .union([
        z.literal(false),
        z
          .object({ from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) })
          .refine((n) => n.from !== n.to, 'nightMode from and to must differ'),
      ])
      .default({ from: 21, to: 6 }),
    /** Where the to-do list is saved. Relative paths are from the working directory. */
    dataDir: z.string().default('data'),
  })
  .refine((c) => c.dayEndHour > c.dayStartHour, {
    message: 'dayEndHour must be greater than dayStartHour',
    path: ['dayEndHour'],
  });

type RawConfig = z.infer<typeof configSchema>;

/**
 * Config with every feed and person given a color: theirs from config, or Autumn's.
 * `customColor` records whether it came from config, so themes know what not to change.
 */
export type AppConfig = Omit<RawConfig, 'feeds' | 'people'> & {
  feeds: (RawConfig['feeds'][number] & { color: string; customColor: boolean })[];
  people: { name: string; color: string; customColor: boolean }[];
};
/** What fetching a feed needs: its name, resolved color and URL. */
export type FeedConfig = Pick<AppConfig['feeds'][number], 'name' | 'color' | 'url'>;

function withColors(c: RawConfig): AppConfig {
  const feeds = feedColors('autumn', c.feeds.map((f) => f.color));
  const people = personColors('autumn', c.feeds.length, c.people.map((p) => p.color));
  return {
    ...c,
    feeds: c.feeds.map((f, i) => ({ ...f, color: feeds[i]!, customColor: f.color !== undefined })),
    people: c.people.map((p, i) => ({ ...p, color: people[i]!, customColor: p.color !== undefined })),
  };
}

export function parseConfig(raw: unknown): AppConfig {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config:\n${z.prettifyError(result.error)}`);
  }
  return withColors(result.data);
}

export function loadConfig(path = process.env.CONFIG_PATH ?? 'config.json'): AppConfig {
  const full = resolve(path);
  let text: string;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${full}. Copy config.example.json to config.json and fill in your feeds.`,
    );
  }
  return parseConfig(JSON.parse(text));
}
