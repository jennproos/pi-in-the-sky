import ICAL from 'ical.js';
import type { CalendarEvent } from '../../shared/types.js';
import { resolveTimeZone, wallTimeToUtcMs } from './timezone.js';

export interface ParseOptions {
  feedName: string;
  color: string;
  rangeStart: Date;
  rangeEnd: Date;
  /** Zone used for floating times and for placing all-day dates. */
  timeZone: string;
}

/** Hard stop so a pathological RRULE can't hang the Pi. */
const MAX_OCCURRENCES_SCANNED = 50_000;
const DAY_MS = 86_400_000;

type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalEvent = InstanceType<typeof ICAL.Event>;

/**
 * Convert an ICAL.Time (timed, not date-only) to a UTC epoch in ms.
 * `tzidHint` is the TZID from the source property; ical.js drops the raw TZID on
 * times it generates while expanding recurrences, so callers pass it back in.
 */
export function toUtcMs(t: IcalTime, defaultTz: string, tzidHint?: string): number {
  const zoneId = t.zone?.tzid;
  if (zoneId === 'UTC' || zoneId === 'Z') return t.toUnixTime() * 1000;

  // Prefer the system tz database for any recognisable zone name.
  // ical.js keeps the raw TZID on `timezone` (untyped) even when no VTIMEZONE was found.
  const rawTzid = (t as unknown as { timezone?: string }).timezone ?? tzidHint;
  const iana = resolveTimeZone(rawTzid ?? (zoneId !== 'floating' ? zoneId : undefined));
  if (!iana && zoneId && zoneId !== 'floating') {
    // Unrecognised name but the feed supplied a VTIMEZONE for it: trust ical.js.
    return t.toUnixTime() * 1000;
  }
  return wallTimeToUtcMs(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    iana ?? defaultTz,
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateString(t: IcalTime): string {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

function dateStartMs(t: IcalTime, tz: string): number {
  return wallTimeToUtcMs({ year: t.year, month: t.month, day: t.day, hour: 0, minute: 0, second: 0 }, tz);
}

function propTzid(e: IcalEvent, name: string): string | undefined {
  const value = e.component.getFirstProperty(name)?.getParameter('tzid');
  return typeof value === 'string' ? value : undefined;
}

function isCancelled(e: IcalEvent): boolean {
  return String(e.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED';
}

/**
 * Build a CalendarEvent for one occurrence, or null if it falls outside the range.
 */
function toCalendarEvent(
  e: IcalEvent,
  start: IcalTime,
  end: IcalTime | null,
  opts: ParseOptions,
  rangeStartMs: number,
  rangeEndMs: number,
): CalendarEvent | null {
  const title = (e.summary ?? '').trim() || '(No title)';
  const location = e.location?.trim() || undefined;
  const base = { feed: opts.feedName, color: opts.color, title, ...(location ? { location } : {}) };

  if (start.isDate) {
    let endDate = end && end.isDate ? end : null;
    if (!endDate || endDate.compare(start) <= 0) {
      endDate = start.clone();
      endDate.adjust(1, 0, 0, 0);
    }
    const s = dateStartMs(start, opts.timeZone);
    const en = dateStartMs(endDate, opts.timeZone);
    if (!(s < rangeEndMs && en > rangeStartMs)) return null;
    const startStr = dateString(start);
    return {
      ...base,
      id: `${opts.feedName}:${e.uid}:${startStr}`,
      allDay: true,
      start: startStr,
      end: dateString(endDate),
    };
  }

  const startTzid = propTzid(e, 'dtstart');
  const s = toUtcMs(start, opts.timeZone, startTzid);
  let en = end ? toUtcMs(end, opts.timeZone, propTzid(e, 'dtend') ?? startTzid) : s;
  if (en < s) en = s;
  // Zero-length events still count as "in range" if they start inside it.
  if (!(s < rangeEndMs && Math.max(en, s + 1) > rangeStartMs)) return null;
  const startIso = new Date(s).toISOString();
  return {
    ...base,
    id: `${opts.feedName}:${e.uid}:${startIso}`,
    allDay: false,
    start: startIso,
    end: new Date(en).toISOString(),
  };
}

/**
 * Parse ICS text and return every event occurrence overlapping [rangeStart, rangeEnd),
 * with recurring events expanded (RRULE/RDATE/EXDATE) and RECURRENCE-ID overrides applied.
 * Throws if the text is not a parseable calendar.
 */
export function parseIcs(text: string, opts: ParseOptions): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  const vcal = root.name === 'vcalendar' ? root : root.getFirstSubcomponent('vcalendar');
  if (!vcal) throw new Error('No VCALENDAR found');

  // Register this feed's VTIMEZONEs while we expand, then remove them so feeds don't
  // leak definitions into each other via ical.js's global TimezoneService.
  const registered: string[] = [];
  for (const vtz of vcal.getAllSubcomponents('vtimezone')) {
    const tzid = vtz.getFirstPropertyValue('tzid');
    if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) {
      ICAL.TimezoneService.register(vtz);
      registered.push(tzid);
    }
  }

  try {
    return expand(vcal, opts);
  } finally {
    for (const tzid of registered) ICAL.TimezoneService.remove(tzid);
  }
}

function expand(vcal: InstanceType<typeof ICAL.Component>, opts: ParseOptions): CalendarEvent[] {
  const rangeStartMs = opts.rangeStart.getTime();
  const rangeEndMs = opts.rangeEnd.getTime();
  const out: CalendarEvent[] = [];

  const masters: IcalEvent[] = [];
  const exceptionsByUid = new Map<string, IcalEvent[]>();

  for (const vevent of vcal.getAllSubcomponents('vevent')) {
    const e = new ICAL.Event(vevent);
    if (!e.startDate) continue;
    if (e.isRecurrenceException()) {
      const list = exceptionsByUid.get(e.uid) ?? [];
      list.push(e);
      exceptionsByUid.set(e.uid, list);
    } else {
      masters.push(e);
    }
  }

  const occurrenceKey = (t: IcalTime, tzid: string | undefined) =>
    t.isDate ? dateString(t) : String(toUtcMs(t, opts.timeZone, tzid));

  for (const e of masters) {
    if (isCancelled(e)) continue;

    if (!e.isRecurring()) {
      const ev = toCalendarEvent(e, e.startDate, e.endDate, opts, rangeStartMs, rangeEndMs);
      if (ev) out.push(ev);
      continue;
    }

    const tzid = propTzid(e, 'dtstart');
    // Occurrences replaced by a RECURRENCE-ID override are emitted from the override instead.
    const overridden = new Set(
      (exceptionsByUid.get(e.uid) ?? []).map((x) =>
        occurrenceKey(x.recurrenceId, propTzid(x, 'recurrence-id') ?? tzid),
      ),
    );

    // Cheap pre-filter: treat wall-clock fields as UTC (off by at most ±14h) and skip
    // occurrences clearly outside the range before doing precise zone conversion.
    const durationMs = e.duration.toSeconds() * 1000;
    const it = e.iterator();
    for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES_SCANNED; i++, next = it.next()) {
      const approx = Date.UTC(next.year, next.month - 1, next.day, next.hour, next.minute, next.second);
      if (approx >= rangeEndMs + DAY_MS) break;
      if (approx + durationMs < rangeStartMs - DAY_MS) continue;
      const startMs = next.isDate ? dateStartMs(next, opts.timeZone) : toUtcMs(next, opts.timeZone, tzid);
      if (startMs >= rangeEndMs) break;
      if (overridden.has(occurrenceKey(next, tzid))) continue;
      const details = e.getOccurrenceDetails(next);
      const ev = toCalendarEvent(e, details.startDate, details.endDate, opts, rangeStartMs, rangeEndMs);
      if (ev) out.push(ev);
    }
  }

  // Overrides: each is a standalone occurrence (it may have moved into or out of range).
  for (const list of exceptionsByUid.values()) {
    for (const x of list) {
      if (isCancelled(x)) continue;
      const ev = toCalendarEvent(x, x.startDate, x.endDate, opts, rangeStartMs, rangeEndMs);
      if (ev) out.push(ev);
    }
  }

  return out;
}
