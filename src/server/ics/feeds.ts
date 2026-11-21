import type { EventsResponse } from '../../shared/types.js';
import type { FeedConfig } from '../config.js';
import { mergeFeeds, type FeedOutcome } from './merge.js';
import { parseIcs } from './parse.js';

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

interface CachedFeed {
  text?: string;
  lastSuccess?: Date;
  lastAttempt?: Date;
  error?: string;
  inflight?: Promise<void>;
}

export interface FeedStoreOptions {
  feeds: FeedConfig[];
  timeZone: string;
  /** Re-download a feed at most this often, however many requests come in. */
  minFetchIntervalMs?: number;
  timeoutMs?: number;
  fetch?: FetchLike;
  now?: () => Date;
}

/** webcal:// is just https:// that calendar apps intercept. */
export function normalizeFeedUrl(url: string): string {
  return url.replace(/^webcals?:\/\//i, 'https://');
}

/**
 * Downloads ICS feeds (with a short cache) and serves merged events for any range.
 * If a feed fails, its last good copy keeps being used and its status reports the error.
 */
export class FeedStore {
  private cache = new Map<string, CachedFeed>();
  private readonly opts: Required<FeedStoreOptions>;

  constructor(opts: FeedStoreOptions) {
    this.opts = {
      minFetchIntervalMs: 60_000,
      timeoutMs: 15_000,
      fetch: (url, init) => fetch(url, init),
      now: () => new Date(),
      ...opts,
    };
  }

  async getEvents(rangeStart: Date, rangeEnd: Date): Promise<EventsResponse> {
    const { feeds, timeZone } = this.opts;
    await Promise.all(feeds.map((f) => this.refresh(f)));

    const outcomes: FeedOutcome[] = feeds.map((feed) => {
      const c = this.cache.get(feed.url) ?? {};
      const base = { name: feed.name, color: feed.color, ...(c.lastSuccess ? { lastSuccess: c.lastSuccess.toISOString() } : {}) };
      if (!c.text) {
        return { status: { ...base, ok: false, error: c.error ?? 'Not loaded', eventCount: 0 }, events: [] };
      }
      try {
        const events = parseIcs(c.text, { feedName: feed.name, color: feed.color, rangeStart, rangeEnd, timeZone });
        const status = c.error
          ? { ...base, ok: false, error: c.error, eventCount: events.length }
          : { ...base, ok: true, eventCount: events.length };
        return { status, events };
      } catch (err) {
        return { status: { ...base, ok: false, error: `Parse error: ${message(err)}`, eventCount: 0 }, events: [] };
      }
    });

    return mergeFeeds(outcomes, { start: rangeStart, end: rangeEnd }, timeZone, this.opts.now());
  }

  private refresh(feed: FeedConfig): Promise<void> {
    const c = this.cache.get(feed.url) ?? {};
    this.cache.set(feed.url, c);
    if (c.inflight) return c.inflight;
    const now = this.opts.now();
    if (c.lastAttempt && now.getTime() - c.lastAttempt.getTime() < this.opts.minFetchIntervalMs) {
      return Promise.resolve();
    }
    c.lastAttempt = now;
    c.inflight = this.download(feed.url)
      .then((text) => {
        c.text = text;
        c.lastSuccess = this.opts.now();
        delete c.error;
      })
      .catch((err: unknown) => {
        c.error = message(err);
      })
      .finally(() => {
        delete c.inflight;
      });
    return c.inflight;
  }

  private async download(url: string): Promise<string> {
    const res = await this.opts.fetch(normalizeFeedUrl(url), {
      signal: AbortSignal.timeout(this.opts.timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Response is not an ICS calendar');
    return text;
  }
}

function message(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? 'Timed out' : err.message;
  return String(err);
}
