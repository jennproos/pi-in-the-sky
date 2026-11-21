import { useState } from 'react';
import type { Weather } from '../../shared/types';
import { api } from '../api';
import { usePolling } from './usePolling';

export function useWeather(intervalMs = 15 * 60_000): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  usePolling(() => {
    api.weather().then(setWeather, () => {
      /* keep the last reading; the server also caches */
    });
  }, intervalMs);
  return weather;
}
