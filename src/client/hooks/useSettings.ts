import { useEffect, useState } from 'react';
import type { ClientSettings } from '../../shared/types';
import { api } from '../api';

/** Loads display settings, retrying until the server answers (it may still be booting). */
export function useSettings(): ClientSettings | null {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = (delay: number) => {
      api
        .settings()
        .then((s) => !cancelled && setSettings(s))
        .catch(() => {
          if (!cancelled) timer = setTimeout(() => load(Math.min(delay * 2, 30_000)), delay);
        });
    };
    load(1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return settings;
}
