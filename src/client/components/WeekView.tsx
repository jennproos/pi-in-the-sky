import type { CalendarEvent } from '../../shared/types';
import { dayKey, eventsForDay } from '../lib/dates';
import { DayColumn } from './DayColumn';

interface Props {
  days: Date[];
  now: Date;
  events: CalendarEvent[];
  onOpenDay: (day: Date) => void;
}

export function WeekView({ days, now, events, onOpenDay }: Props) {
  return (
    <div className="week">
      {days.map((day) => (
        <DayColumn key={dayKey(day)} day={day} now={now} events={eventsForDay(events, day)} onOpen={() => onOpenDay(day)} />
      ))}
    </div>
  );
}
