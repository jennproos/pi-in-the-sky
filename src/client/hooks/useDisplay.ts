import { useCallback, useEffect, useMemo, useState } from 'react';
import { feedColors, isNightHour, personColors, type ThemeName } from '../../shared/themes';
import type { ClientSettings, DisplayPrefs, Person } from '../../shared/types';
import { api } from '../api';
import { applyTheme } from '../lib/theme';

export interface DisplayState {
  prefs: DisplayPrefs;
  /** True while the night hours are on and automatic night mode is enabled. */
  isNight: boolean;
  /** The theme on screen right now. */
  active: ThemeName;
  /** Feed name → color. Follows the chosen theme, even at night, so calendars stay recognizable. */
  feedColors: Map<string, string>;
  /** To-do people with their colors for the chosen theme. */
  people: Person[];
  error: string | null;
  change: (patch: Partial<DisplayPrefs>) => void;
}

/**
 * The chosen theme, automatic night mode, and saving changes to the server.
 * `previewChosen` shows the chosen theme even at night, so the picker shows what you pick.
 */
export function useDisplay(settings: ClientSettings, now: Date, previewChosen: boolean): DisplayState {
  const [prefs, setPrefs] = useState(settings.display);
  const [error, setError] = useState<string | null>(null);

  const hours = settings.nightHours;
  const isNight = prefs.autoNight && hours !== null && isNightHour(now, hours.from, hours.to);
  const active: ThemeName = isNight && !previewChosen ? 'night' : prefs.theme;

  useEffect(() => applyTheme(active), [active]);

  const feeds = settings.feeds;
  const colors = useMemo(() => {
    const list = feedColors(prefs.theme, feeds.map((f) => f.color));
    return new Map(feeds.map((f, i) => [f.name, list[i]!]));
  }, [prefs.theme, feeds]);

  const configPeople = settings.people;
  const people = useMemo(() => {
    const list = personColors(prefs.theme, feeds.length, configPeople.map((p) => p.color));
    return configPeople.map((p, i) => ({ ...p, color: list[i]! }));
  }, [prefs.theme, feeds.length, configPeople]);

  const change = useCallback((patch: Partial<DisplayPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setError(null);
    // Keep the choice on screen even if saving fails; it just won't survive a reload.
    api.updateDisplay(patch).catch(() => setError("Couldn't save this choice. It will reset after a restart."));
  }, []);

  return { prefs, isNight, active, feedColors: colors, people, error, change };
}
