import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
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
          color: hexColor,
          url: z.string().regex(/^(https?|webcals?):\/\/\S+$/i, 'must be an http(s) or webcal URL'),
        }),
      )
      .min(1, 'add at least one feed'),
    /** People to-do items can be assigned to. */
    people: z
      .array(z.object({ name: z.string().trim().min(1).max(30), color: hexColor }))
      .max(8)
      .default([])
      .refine((ps) => new Set(ps.map((p) => p.name.toLowerCase())).size === ps.length, 'people names must be unique'),
    /** Where the to-do list is saved. Relative paths are from the working directory. */
    dataDir: z.string().default('data'),
  })
  .refine((c) => c.dayEndHour > c.dayStartHour, {
    message: 'dayEndHour must be greater than dayStartHour',
    path: ['dayEndHour'],
  });

export type AppConfig = z.infer<typeof configSchema>;
export type FeedConfig = AppConfig['feeds'][number];

export function parseConfig(raw: unknown): AppConfig {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
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
