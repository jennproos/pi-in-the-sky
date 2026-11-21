/**
 * Time zone helpers built on Intl, so we rely on the OS/ICU tz database rather
 * than whatever (possibly stale or missing) VTIMEZONE block a feed ships with.
 */

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Common Windows zone names (Outlook / Exchange feeds) mapped to IANA ids. */
const WINDOWS_ZONES: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Atlantic Standard Time': 'America/Halifax',
  'Newfoundland Standard Time': 'America/St_Johns',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  UTC: 'UTC',
};

const validity = new Map<string, boolean>();

export function isValidTimeZone(tz: string): boolean {
  let ok = validity.get(tz);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      ok = true;
    } catch {
      ok = false;
    }
    validity.set(tz, ok);
  }
  return ok;
}

/** Resolve a TZID from a feed to an IANA id, or undefined if unknown. */
export function resolveTimeZone(tzid: string | undefined | null): string | undefined {
  if (!tzid) return undefined;
  // Some feeds prefix TZIDs with a path, e.g. "/mozilla.org/20050126_1/America/New_York".
  const cleaned = tzid.replace(/^\/.*?\/(?=[A-Z][a-z]+\/)/, '').trim();
  if (isValidTimeZone(cleaned)) return cleaned;
  return WINDOWS_ZONES[cleaned];
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock time in `tz` for a UTC instant. */
export function utcToWallTime(utcMs: number, tz: string): WallTime {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

function offsetMs(utcMs: number, tz: string): number {
  const w = utcToWallTime(utcMs, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to a UTC instant (ms). */
export function wallTimeToUtcMs(w: WallTime, tz: string): number {
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Two passes handle the offset changing between the guess and the answer (DST).
  const first = wallAsUtc - offsetMs(wallAsUtc, tz);
  return wallAsUtc - offsetMs(first, tz);
}

export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
