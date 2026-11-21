import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ClientSettings } from '../shared/types.js';
import type { AppConfig } from './config.js';
import { FeedStore, type FetchLike } from './ics/feeds.js';
import { WeatherService } from './weather.js';

/** Largest range a single /api/events request may cover. */
const MAX_RANGE_MS = 62 * 86_400_000;

export interface AppDeps {
  fetch?: FetchLike;
  /** Directory with the built client; served when it exists. */
  clientDir?: string;
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

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings', async (): Promise<ClientSettings> => ({
    locationName: config.location.name,
    weekStartsOn: config.weekStartsOn,
    dayStartHour: config.dayStartHour,
    dayEndHour: config.dayEndHour,
    refreshMinutes: config.refreshMinutes,
    feeds: config.feeds.map(({ name, color }) => ({ name, color })),
  }));

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

  const clientDir = deps.clientDir ?? defaultClientDir();
  if (existsSync(join(clientDir, 'index.html'))) {
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
