import { addHours, isSameDay, startOfDay } from 'date-fns';
import type { CSSProperties } from 'react';
import type { CalendarEvent } from '../../shared/types';
import { eventEnd, eventStart, formatTime } from '../lib/dates';
import { layoutDay } from '../lib/dayLayout';
import { EventCard } from './EventCard';

interface Props {
  day: Date;
  now: Date;
  events: CalendarEvent[];
  startHour: number;
  endHour: number;
}

/** Events shorter than this get a single-line layout so the title isn't clipped. */
const SHORT_MS = 90 * 60_000;

export function DayView({ day, now, events, startHour, endHour }: Props) {
  const ws = addHours(startOfDay(day), startHour);
  const we = addHours(startOfDay(day), endHour);
  const { placed, allDay, earlier, later } = layoutDay(events, ws, we);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => addHours(ws, i));
  const showNow = isSameDay(day, now) && now >= ws && now < we;
  const nowTop = (now.getTime() - ws.getTime()) / (we.getTime() - ws.getTime());
  const sideEmpty = allDay.length + earlier.length + later.length === 0;

  return (
    <div className={`dayview${sideEmpty ? ' no-side' : ''}`}>
      <div className="grid">
        <div className="grid-hours" aria-hidden="true">
          {hours.map((h) => (
            <div key={h.getTime()} className="grid-hour">
              <span>{formatTime(h)}</span>
            </div>
          ))}
          <div className="grid-hour-end">
            <span>{formatTime(we)}</span>
          </div>
        </div>
        <div className="grid-events">
          {hours.map((h) => (
            <div key={h.getTime()} className="grid-line" />
          ))}
          {placed.map((p) => {
            const short = Math.min(eventEnd(p.event).getTime(), we.getTime()) - Math.max(eventStart(p.event).getTime(), ws.getTime()) < SHORT_MS;
            return (
              <EventCard
                key={p.event.id}
                event={p.event}
                day={day}
                now={now}
                showLocation={!short}
                className={`placed${short ? ' is-short' : ''}`}
                style={
                  {
                    top: `${p.top * 100}%`,
                    height: `${p.height * 100}%`,
                    left: `${p.left * 100}%`,
                    width: `${p.width * 100}%`,
                  } as CSSProperties
                }
              />
            );
          })}
          <div className="grid-line-end" />
          {showNow && <div className="now-line" style={{ top: `${nowTop * 100}%` }} />}
        </div>
      </div>

      {!sideEmpty && (
        <aside className="day-side">
          <SideGroup title="All day" events={allDay} day={day} now={now} />
          <SideGroup title={`Before ${formatTime(ws)}`} events={earlier} day={day} now={now} />
          <SideGroup title={`After ${formatTime(we)}`} events={later} day={day} now={now} />
        </aside>
      )}
    </div>
  );
}

function SideGroup({ title, events, day, now }: { title: string; events: CalendarEvent[]; day: Date; now: Date }) {
  if (events.length === 0) return null;
  return (
    <section className="side-group">
      <h2>{title}</h2>
      {events.map((e) => (
        <EventCard key={e.id} event={e} day={day} now={now} showLocation />
      ))}
    </section>
  );
}
