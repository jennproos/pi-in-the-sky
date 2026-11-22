import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { THEME_NAMES } from '../shared/themes.js';
import type { ClientSettings } from '../shared/types.js';
import type { AppConfig } from './config.js';
import { DisplayStore } from './display.js';
import { FeedStore, type FetchLike } from './ics/feeds.js';
import { sortTodos, TodoStore } from './todos.js';
import { WeatherService } from './weather.js';

/** Largest range a single /api/events request may cover. */
const MAX_RANGE_MS = 62 * 86_400_000;

export interface AppDeps {
  fetch?: FetchLike;
  /** Directory with the built client; served when it exists. */
  clientDir?: string;
  /** Override where the to-do list is saved (tests). */
  todoFile?: string;
  /** Override where display choices are saved (tests). */
  displayFile?: string;
  logger?: boolean;
}

export function defaultClientDir(): string {
  // dist/server/app.js → dist/client
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'client');
}

export async function buildApp(config: AppConfig, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });

  const feeds = new FeedStore({
    feeds: config.feeds,
    timeZone: config.timeZone,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
  const weather = new WeatherService({
    latitude: config.location.latitude,
    longitude: config.location.longitude,
    units: config.units,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });

  const todos = new TodoStore({
    file: deps.todoFile ?? resolve(config.dataDir, 'todos.json'),
    timeZone: config.timeZone,
    log: (msg) => app.log.warn(msg),
  });

  const display = new DisplayStore(deps.displayFile ?? resolve(config.dataDir, 'display.json'), {
    theme: config.theme,
    autoNight: config.nightMode !== false,
  });

  // Identifies the client build being served, so open screens can reload after a deploy.
  // deploy/deploy.sh computes the same value to confirm the new version is live.
  const clientDir = deps.clientDir ?? defaultClientDir();
  const indexHtml = join(clientDir, 'index.html');
  const version = existsSync(indexHtml)
    ? createHash('sha256').update(readFileSync(indexHtml)).digest('hex').slice(0, 12)
    : 'dev';

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/version', async () => ({ version }));

  app.get('/api/settings', async (): Promise<ClientSettings> => ({
    locationName: config.location.name,
    weekStartsOn: config.weekStartsOn,
    dayStartHour: config.dayStartHour,
    dayEndHour: config.dayEndHour,
    refreshMinutes: config.refreshMinutes,
    feeds: config.feeds.map(({ name, color }) => ({ name, color })),
    people: config.people,
    display: await display.get(),
    nightHours: config.nightMode || null,
  }));

  const displayPatch = z
    .object({ theme: z.enum(THEME_NAMES).optional(), autoNight: z.boolean().optional() })
    .refine((p) => p.theme !== undefined || p.autoNight !== undefined, 'Nothing to change');

  app.patch('/api/display', async (req, reply) => {
    const parsed = displayPatch.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    const { theme, autoNight } = parsed.data;
    return display.update({ ...(theme !== undefined && { theme }), ...(autoNight !== undefined && { autoNight }) });
  });

  // To-do list ---------------------------------------------------------------

  const canonicalName = new Map(config.people.map((p) => [p.name.toLowerCase(), p.name]));
  const todoText = z.string().trim().min(1, 'Type something first').max(200, 'Keep it under 200 characters');
  const assignees = z
    .array(z.string())
    .max(8)
    .transform((names, ctx) => {
      const out: string[] = [];
      for (const n of names) {
        const name = canonicalName.get(n.trim().toLowerCase());
        if (!name) {
          ctx.addIssue({ code: 'custom', message: `Unknown person: ${n}` });
          return z.NEVER;
        }
        if (!out.includes(name)) out.push(name);
      }
      // Keep config order so "both" always reads the same way.
      return config.people.map((p) => p.name).filter((p) => out.includes(p));
    });
  const newTodo = z.object({ text: todoText, assignees: assignees.default([]) });
  const todoPatch = z
    .object({ text: todoText.optional(), assignees: assignees.optional(), done: z.boolean().optional() })
    .refine((p) => Object.keys(p).length > 0, 'Nothing to change');

  const badRequest = (err: z.ZodError) => ({ error: err.issues.map((i) => i.message).join('; ') });

  app.get('/api/todos', async () => ({ todos: sortTodos(await todos.list()) }));

  app.post('/api/todos', async (req, reply) => {
    const parsed = newTodo.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(badRequest(parsed.error));
    return reply.code(201).send(await todos.add(parsed.data));
  });

  app.patch<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) => {
    const parsed = todoPatch.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(badRequest(parsed.error));
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    const updated = await todos.update(req.params.id, patch);
    return updated ?? reply.code(404).send({ error: 'That item no longer exists' });
  });

  app.delete<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) => {
    const removed = await todos.remove(req.params.id);
    return removed ? reply.code(204).send() : reply.code(404).send({ error: 'That item no longer exists' });
  });

  app.get<{ Querystring: { start?: string; end?: string } }>('/api/events', async (req, reply) => {
    const start = new Date(req.query.start ?? '');
    const end = new Date(req.query.end ?? '');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return reply.code(400).send({ error: 'start and end must be ISO dates with end after start' });
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
      return reply.code(400).send({ error: 'range too large (max 62 days)' });
    }
    return feeds.getEvents(start, end);
  });

  app.get('/api/weather', async (_req, reply) => {
    try {
      return await weather.get();
    } catch (err) {
      app.log.warn({ err }, 'weather fetch failed');
      return reply.code(502).send({ error: 'Weather unavailable' });
    }
  });

  if (version !== 'dev') {
    // Files are looked up on disk per request, so a rebuild doesn't need a restart.
    await app.register(fastifyStatic, { root: clientDir });
    app.setNotFoundHandler((req, reply) => {
      const path = req.url.split('?')[0] ?? '';
      // Missing API routes and assets get a real 404; anything else is an app route.
      if (path.startsWith('/api/') || /\.[a-z0-9]+$/i.test(path)) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
