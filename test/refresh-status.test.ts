import { describe, expect, it } from 'vitest';
import { describeRefreshProblem } from '../src/client/components/RefreshStatus.js';

const now = new Date(2026, 10, 21, 15, 10);
const at = (h: number, m: number) => new Date(2026, 10, 21, h, m);
const feed = (name: string, lastSuccess?: Date) => ({
  name,
  color: '#000000',
  ok: false,
  eventCount: 0,
  ...(lastSuccess ? { lastSuccess: lastSuccess.toISOString() } : {}),
});

describe('describeRefreshProblem', () => {
  it('says nothing when everything refreshed', () => {
    expect(describeRefreshProblem({ now, error: null, lastSuccess: at(15, 5), failedFeeds: [] })).toBeNull();
  });

  it('explains a server outage and how old the data is', () => {
    expect(describeRefreshProblem({ now, error: 'HTTP 502', lastSuccess: at(14, 55), failedFeeds: [] })).toBe(
      "Can't reach the calendar server. Showing events from 2:55 pm.",
    );
  });

  it('names feeds that failed', () => {
    expect(
      describeRefreshProblem({ now, error: null, lastSuccess: now, failedFeeds: [feed('School', at(14, 30)), feed('Work', at(14, 50))] }),
    ).toBe("School and Work calendars didn't update. Showing events from 2:30 pm.");
  });

  it('points at config for feeds that never loaded', () => {
    expect(describeRefreshProblem({ now, error: null, lastSuccess: now, failedFeeds: [feed('Broken')] })).toBe(
      "Broken calendar couldn't load. Check the link in config.json.",
    );
  });
});
