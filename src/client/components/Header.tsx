import { format } from 'date-fns';
import type { Weather } from '../../shared/types';
import { formatClock, type View } from '../lib/dates';
import { WeatherIcon } from './WeatherIcon';

interface HeaderProps {
  now: Date;
  weather: Weather | null;
  view: View;
  period: string;
  isCurrentPeriod: boolean;
  onViewChange: (v: View) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function Header(p: HeaderProps) {
  const clock = formatClock(p.now);
  return (
    <header className="header">
      <div className="header-now">
        <div className="clock">
          {clock.time}
          <span className="clock-period">{clock.period}</span>
        </div>
        <div className="header-date">{format(p.now, 'EEEE, MMMM d')}</div>
      </div>

      <nav className="header-nav" aria-label="Calendar navigation">
        <button type="button" className="icon-button" onClick={p.onPrev} aria-label={`Previous ${p.view}`}>
          <Chevron dir="left" />
        </button>
        <div className="period">{p.period}</div>
        <button type="button" className="icon-button" onClick={p.onNext} aria-label={`Next ${p.view}`}>
          <Chevron dir="right" />
        </button>
        <button type="button" className="text-button" onClick={p.onToday} disabled={p.isCurrentPeriod}>
          Today
        </button>
        <div className="segmented" role="group" aria-label="View">
          {(['week', 'day'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={p.view === v} onClick={() => p.onViewChange(v)}>
              {v === 'week' ? 'Week' : 'Day'}
            </button>
          ))}
        </div>
      </nav>

      <div className="header-weather">
        {p.weather ? (
          <>
            <WeatherIcon code={p.weather.weatherCode} isDay={p.weather.isDay} size={72} />
            <div>
              <div className="temp">{p.weather.temperature}°</div>
              <div className="weather-detail">
                {p.weather.description}
                {p.weather.high !== null && p.weather.low !== null && (
                  <span className="hilo">
                    {p.weather.high}° / {p.weather.low}°
                  </span>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
