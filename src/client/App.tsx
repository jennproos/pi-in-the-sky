import { isSameDay, isSameWeek } from 'date-fns';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import type { ClientSettings } from '../shared/types';
import { Header } from './components/Header';
import { WeekView } from './components/WeekView';
import { useEvents } from './hooks/useEvents';
import { useNow } from './hooks/useNow';
import { useSettings } from './hooks/useSettings';
import { useWeather } from './hooks/useWeather';
import { fetchRange, periodLabel, step, weekDays, type View } from './lib/dates';

export function App() {
  const settings = useSettings();
  if (!settings) return <div className="loading">Connecting to the calendar server…</div>;
  return <Calendar settings={settings} />;
}

function Calendar({ settings }: { settings: ClientSettings }) {
  const now = useNow();
  const weather = useWeather();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const ws = settings.weekStartsOn;

  const isCurrentPeriod =
    view === 'week' ? isSameWeek(anchor, now, { weekStartsOn: ws }) : isSameDay(anchor, now);

  const range = useMemo(() => fetchRange(anchor, ws), [anchor, ws]);
  const events = useEvents(range.start, range.end, settings.refreshMinutes * 60_000);
  const days = useMemo(() => weekDays(anchor, ws), [anchor, ws]);

  const openDay = useCallback((day: Date) => {
    setAnchor(day);
    setView('day');
  }, []);

  const go = useCallback((dir: 1 | -1) => setAnchor((a) => step(view, a, dir)), [view]);
  const legend = useMemo(() => settings.feeds, [settings.feeds]);

  return (
    <div className="app">
      <Header
        now={now}
        weather={weather}
        view={view}
        period={periodLabel(view, anchor, ws)}
        isCurrentPeriod={isCurrentPeriod}
        onViewChange={setView}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onToday={() => setAnchor(new Date())}
      />
      <main className="main">
        <WeekView days={days} now={now} events={events.data?.events ?? []} onOpenDay={openDay} />
      </main>
      <footer className="footer">
        <ul className="legend">
          {legend.map((f) => (
            <li key={f.name} style={{ '--feed': f.color } as CSSProperties}>
              <span className="swatch" />
              {f.name}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
