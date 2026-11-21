import type { Weather } from '../shared/types.js';
import type { FetchLike } from './ics/feeds.js';

/** WMO weather interpretation codes used by Open-Meteo. */
const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

export function describeWeatherCode(code: number): string {
  return WMO[code] ?? 'Unknown';
}

interface OpenMeteoResponse {
  current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
}

export interface WeatherOptions {
  latitude: number;
  longitude: number;
  units: 'fahrenheit' | 'celsius';
  fetch?: FetchLike;
  cacheMs?: number;
  now?: () => Date;
}

export function openMeteoUrl(o: Pick<WeatherOptions, 'latitude' | 'longitude' | 'units'>): string {
  const params = new URLSearchParams({
    latitude: String(o.latitude),
    longitude: String(o.longitude),
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    temperature_unit: o.units,
    timezone: 'auto',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function parseOpenMeteo(json: OpenMeteoResponse, units: WeatherOptions['units'], now: Date): Weather {
  const c = json.current;
  if (typeof c?.temperature_2m !== 'number' || typeof c.weather_code !== 'number') {
    throw new Error('Unexpected Open-Meteo response');
  }
  return {
    temperature: Math.round(c.temperature_2m),
    unit: units === 'celsius' ? 'C' : 'F',
    weatherCode: c.weather_code,
    description: describeWeatherCode(c.weather_code),
    isDay: c.is_day !== 0,
    high: roundOrNull(json.daily?.temperature_2m_max?.[0]),
    low: roundOrNull(json.daily?.temperature_2m_min?.[0]),
    fetchedAt: now.toISOString(),
  };
}

function roundOrNull(n: number | undefined): number | null {
  return typeof n === 'number' ? Math.round(n) : null;
}

/** Cached Open-Meteo client. Returns the last good reading if a refresh fails. */
export class WeatherService {
  private last?: Weather;
  private lastFetch = 0;
  private readonly fetchFn: FetchLike;
  private readonly cacheMs: number;
  private readonly now: () => Date;

  constructor(private readonly opts: WeatherOptions) {
    this.fetchFn = opts.fetch ?? ((url, init) => fetch(url, init));
    this.cacheMs = opts.cacheMs ?? 10 * 60_000;
    this.now = opts.now ?? (() => new Date());
  }

  async get(): Promise<Weather> {
    const now = this.now();
    if (this.last && now.getTime() - this.lastFetch < this.cacheMs) return this.last;
    try {
      const res = await this.fetchFn(openMeteoUrl(this.opts), { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      this.last = parseOpenMeteo((await res.json()) as OpenMeteoResponse, this.opts.units, now);
      this.lastFetch = now.getTime();
      return this.last;
    } catch (err) {
      if (this.last) return this.last;
      throw err;
    }
  }
}
