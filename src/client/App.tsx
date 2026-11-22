import { isSameDay, isSameWeek } from 'date-fns';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ClientSettings } from '../shared/types';
import { DayView } from './components/DayView';
import { Header } from './components/Header';
import { RefreshStatus } from './components/RefreshStatus';
import { TodoPanel } from './components/TodoPanel';
import { WeekView } from './components/WeekView';
import { useEvents } from './hooks/useEvents';
import { useIdleReset } from './hooks/useIdleReset';
import { useNow } from './hooks/useNow';
import { useSettings } from './hooks/useSettings';
import { useSwipe } from './hooks/useSwipe';
import { useTodos } from './hooks/useTodos';
import { useWeather } from './hooks/useWeather';
import { dayKey, eventsForDay, fetchRange, parseDateKey, periodLabel, step, weekDays, type View } from './lib/dates';

/** Return to this week after this long without a touch. */
const IDLE_RESET_MS = 3 * 60_000;

const initialParams = new URLSearchParams(window.location.search);

export function App() {
  const settings = useSettings();
  if (!settings) return <div className="loading">Connecting to the calendar server…</div>;
  return <Calendar settings={settings} />;
}

function Calendar({ settings }: { settings: ClientSettings }) {
  const now = useNow();
  const weather = useWeather();
  const todos = useTodos();
  /** Bumped by the idle reset to put the to-do panel back to its default state. */
  const [resetCount, setResetCount] = useState(0);
  // Optional ?view=day&date=2026-11-21 for development and screenshots.
  const [view, setView] = useState<View>(() => (initialParams.get('view') === 'day' ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(() => {
    const d = initialParams.get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseDateKey(d) : new Date();
  });
  /** Direction of the last navigation, for the slide-in animation. */
  const [motion, setMotion] = useState<'next' | 'prev' | 'none'>('none');
  const ws = settings.weekStartsOn;

  const isCurrentPeriod =
    view === 'week' ? isSameWeek(anchor, now, { weekStartsOn: ws }) : isSameDay(anchor, now);

  const range = useMemo(() => fetchRange(anchor, ws), [anchor, ws]);
  const events = useEvents(range.start, range.end, settings.refreshMinutes * 60_000);
  const days = useMemo(() => weekDays(anchor, ws), [anchor, ws]);
  const allEvents = events.data?.events ?? [];

  const go = useCallback(
    (dir: 1 | -1) => {
      setMotion(dir === 1 ? 'next' : 'prev');
      setAnchor((a) => step(view, a, dir));
    },
    [view],
  );

  const goToday = useCallback(() => {
    setMotion('none');
    setAnchor(new Date());
  }, []);

  const openDay = useCallback((day: Date) => {
    setMotion('none');
    setAnchor(day);
    setView('day');
  }, []);

  const changeView = useCallback((v: View) => {
    setMotion('none');
    setView(v);
  }, []);

  useIdleReset(
    IDLE_RESET_MS,
    () => {
      setMotion('none');
      setView('week');
      setAnchor(new Date());
      setResetCount((n) => n + 1);
    },
    dayKey(now),
  );

  // Reload once a night: picks up new builds and keeps a long-running kiosk tab lean.
  useEffect(() => {
    if (now.getHours() === 3 && now.getMinutes() === 0) window.location.reload();
  }, [now]);

  const swipe = useSwipe((dir) => go(dir === 'left' ? 1 : -1));
  const periodKey = view === 'week' ? `w${dayKey(days[0]!)}` : `d${dayKey(anchor)}`;

  return (
    <div className="app">
      <Header
        now={now}
        weather={weather}
        view={view}
        period={periodLabel(view, anchor, ws)}
        isCurrentPeriod={isCurrentPeriod}
        onViewChange={changeView}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onToday={goToday}
      />
      <main className="main">
        <div className="calendar-area" {...swipe}>
          <div key={periodKey} className={`period-body slide-${motion}`}>
            {view === 'week' ? (
              <WeekView days={days} now={now} events={allEvents} onOpenDay={openDay} />
            ) : (
              <DayView
                day={anchor}
                now={now}
                events={eventsForDay(allEvents, anchor)}
                startHour={settings.dayStartHour}
                endHour={settings.dayEndHour}
              />
            )}
          </div>
        </div>
        <TodoPanel key={resetCount} people={settings.people} state={todos} keyboard="onscreen" />
      </main>
      <footer className="footer">
        <ul className="legend">
          {settings.feeds.map((f) => (
            <li
              key={f.name}
              className={events.failedFeeds.some((x) => x.name === f.name) ? 'is-failed' : undefined}
              style={{ '--feed': f.color } as CSSProperties}
            >
              <span className="swatch" />
              {f.name}
            </li>
          ))}
        </ul>
        <RefreshStatus
          now={now}
          error={events.error}
          lastSuccess={events.lastSuccess}
          failedFeeds={events.failedFeeds}
          onRetry={events.refresh}
        />
      </footer>
    </div>
  );
}
