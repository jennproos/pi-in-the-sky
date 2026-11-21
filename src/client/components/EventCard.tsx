import type { CSSProperties } from 'react';
import type { CalendarEvent } from '../../shared/types';
import { eventEnd, timeLabel } from '../lib/dates';

interface Props {
  event: CalendarEvent;
  day: Date;
  now: Date;
  showLocation?: boolean;
  style?: CSSProperties;
  className?: string;
  hidden?: boolean;
}

export function EventCard({ event, day, now, showLocation, style, className = '', hidden }: Props) {
  const done = eventEnd(event).getTime() <= now.getTime();
  const classes = ['event', event.allDay ? 'is-allday' : '', done ? 'is-done' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <article
      className={classes}
      data-card
      aria-hidden={hidden || undefined}
      style={{ '--feed': event.color, ...style } as CSSProperties}
    >
      {!event.allDay && <div className="event-time">{timeLabel(event, day)}</div>}
      <div className="event-title">{event.title}</div>
      {showLocation && event.location && <div className="event-location">{event.location}</div>}
    </article>
  );
}
