import { format, isBefore, isSameDay, isSameMonth, startOfDay } from 'date-fns';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CalendarEvent } from '../../shared/types';
import { dayKey, eventEnd, eventStart, formatTime, monthWeeks } from '../lib/dates';
import { layoutMonthWeek } from '../lib/monthLayout';

interface Props {
  anchor: Date;
  now: Date;
  events: CalendarEvent[];
  weekStartsOn: 0 | 1;
  onOpenDay: (day: Date) => void;
}

/** Height of the date numeral line, and of each event line below it (px). */
const HEAD = 46;
const LANE = 34;
const LANE_GAP = 4;
const BOTTOM_PAD = 6;

export function MonthView({ anchor, now, events, weekStartsOn, onOpenDay }: Props) {
  const weeks = useMemo(() => monthWeeks(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const rowRef = useRef<HTMLDivElement>(null);
  const [lanes, setLanes] = useState(2);

  // Fit as many event lines as the row height allows; rows are all the same height.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const free = row.clientHeight - HEAD - BOTTOM_PAD;
      setLanes(Math.max(1, Math.floor((free + LANE_GAP) / (LANE + LANE_GAP))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [weeks.length]);

  const today = startOfDay(now);
  const rows = `${HEAD}px repeat(${lanes}, ${LANE}px) minmax(0, 1fr)`;

  return (
    <div className="month" style={{ gridTemplateRows: `auto repeat(${weeks.length}, minmax(0, 1fr))` }}>
      <div className="month-weekdays" aria-hidden="true">
        {weeks[0]!.map((d) => (
          <span key={d.getDay()}>{format(d, 'EEE')}</span>
        ))}
      </div>
      {weeks.map((days, w) => {
        const layout = layoutMonthWeek(days, events, lanes);
        const outside = days.map((d) => !isSameMonth(d, anchor));
        return (
          <div key={dayKey(days[0]!)} ref={w === 0 ? rowRef : undefined} className="month-week" style={{ gridTemplateRows: rows }}>
            {days.map((d, col) => (
              <button
                key={dayKey(d)}
                type="button"
                className={[
                  'month-day',
                  isSameDay(d, now) ? 'is-today' : '',
                  outside[col] ? 'is-outside' : '',
                  isBefore(d, today) ? 'is-past' : '',
                ].join(' ')}
                style={{ gridColumn: col + 1 }}
                onClick={() => onOpenDay(d)}
                aria-label={`Open ${format(d, 'EEEE, MMMM d')}`}
              >
                <span className="month-num">{format(d, 'd')}</span>
              </button>
            ))}

            {layout.bars.map((b) => (
              <div
                key={`${b.event.id}-${b.col}`}
                className={[
                  'month-item is-bar',
                  b.startsHere ? 'starts-here' : '',
                  b.endsHere ? 'ends-here' : '',
                  outside.slice(b.col, b.col + b.span).every(Boolean) ? 'is-outside' : '',
                  eventEnd(b.event) <= today ? 'is-done' : '',
                ].join(' ')}
                style={place(b.col, b.span, b.lane, b.event.color)}
              >
                <span className="month-title">{b.event.title}</span>
              </div>
            ))}

            {layout.chips.map((c) => {
              const timed = !c.event.allDay;
              const start = eventStart(c.event);
              return (
                <div
                  key={`${c.event.id}-${c.col}`}
                  className={[
                    'month-item',
                    timed ? 'is-timed' : 'is-allday',
                    outside[c.col] ? 'is-outside' : '',
                    eventEnd(c.event) <= now ? 'is-done' : '',
                  ].join(' ')}
                  style={place(c.col, 1, c.lane, c.event.color)}
                >
                  {timed && <span className="month-dot" />}
                  {/* Only show the time on the day the event starts. */}
                  {timed && isSameDay(start, days[c.col]!) && <span className="month-time">{formatTime(start)}</span>}
                  <span className="month-title">{c.event.title}</span>
                </div>
              );
            })}

            {layout.more.map((m) => (
              <div key={`more-${m.col}`} className="month-item is-more" style={place(m.col, 1, m.lane)}>
                +{m.count} more
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function place(col: number, span: number, lane: number, color?: string): CSSProperties {
  return {
    gridColumn: `${col + 1} / span ${span}`,
    gridRow: lane + 2,
    ...(color ? { '--feed': color } : {}),
  } as CSSProperties;
}
