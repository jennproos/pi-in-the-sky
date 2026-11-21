import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../../shared/types';
import { EventCard } from './EventCard';

interface Props {
  day: Date;
  now: Date;
  events: CalendarEvent[];
  onOpen: () => void;
}

/** Height reserved for the "+N more" button when not everything fits. */
const MORE_HEIGHT = 64;

/**
 * One day in the week view. Cards that don't fit are hidden behind a "+N more" button
 * (no scrolling). Hidden cards keep their layout so measuring stays stable.
 */
export function DayColumn({ day, now, events, onOpen }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(events.length);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const list = listRef.current;
    if (!body || !list) return;
    const measure = () => {
      const max = body.clientHeight;
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-card]'));
      const bottom = (el: HTMLElement) => el.offsetTop + el.offsetHeight;
      const last = cards.at(-1);
      if (!last || bottom(last) <= max) {
        setFit(cards.length);
        return;
      }
      const n = cards.findIndex((c) => bottom(c) > max - MORE_HEIGHT);
      setFit(Math.max(0, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(list);
    void document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [events]);

  const isToday = isSameDay(day, now);
  const isPast = isBefore(day, startOfDay(now));
  const hiddenCount = events.length - fit;

  return (
    <section className={`day-col${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`}>
      <button type="button" className="day-head" onClick={onOpen} aria-label={`Open ${format(day, 'EEEE, MMMM d')}`}>
        <span className="day-name">{format(day, 'EEE')}</span>
        <span className="day-num">{format(day, 'd')}</span>
      </button>
      <div className="day-body" ref={bodyRef}>
        <div className="day-list" ref={listRef}>
          {events.map((e, i) => (
            <EventCard key={e.id} event={e} day={day} now={now} hidden={i >= fit} className={i >= fit ? 'is-overflow' : ''} />
          ))}
          {events.length === 0 && <div className="day-empty">Nothing planned</div>}
        </div>
        {hiddenCount > 0 && (
          <button type="button" className="more" onClick={onOpen}>
            +{hiddenCount} more
          </button>
        )}
      </div>
    </section>
  );
}
