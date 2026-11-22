import { useEffect, type CSSProperties } from 'react';
import { feedColors as themeFeedColors, THEME_NAMES, THEMES } from '../../shared/themes';
import type { DisplayPrefs } from '../../shared/types';
import { formatHour, paletteVars } from '../lib/theme';

interface Props {
  prefs: DisplayPrefs;
  nightHours: { from: number; to: number } | null;
  /** Feed colors from config, to preview each theme's calendar colors. */
  feedColors: string[];
  /** It's night hours and automatic night mode is on. */
  isNight: boolean;
  error: string | null;
  onChange: (patch: Partial<DisplayPrefs>) => void;
  onClose: () => void;
}

/** Pick a color theme and turn automatic night mode on or off. */
export function ThemePicker({ prefs, nightHours, feedColors, isNight, error, onChange, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet theme-sheet" role="dialog" aria-label="Theme" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Theme</h2>

        <div className="theme-grid" role="group" aria-label="Color theme">
          {THEME_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className="theme-tile"
              aria-pressed={prefs.theme === name}
              onClick={() => onChange({ theme: name })}
              // The tile draws itself in its own theme's colors.
              style={paletteVars(name) as CSSProperties}
            >
              <span className="theme-preview" aria-hidden="true">
                <span className="theme-preview-col">
                  <span className="theme-preview-today" />
                  {/* Night keeps the chosen theme's calendar colors. */}
                  {themeFeedColors(name === 'night' ? prefs.theme : name, feedColors.slice(0, 3)).map((c, i) => (
                    <span key={i} className="theme-preview-event" style={{ '--feed': c } as CSSProperties} />
                  ))}
                </span>
                <span className="theme-preview-control" />
              </span>
              <span className="theme-name">{THEMES[name].label}</span>
            </button>
          ))}
        </div>

        {nightHours && (
          <div className="sheet-people">
            <button
              type="button"
              className="theme-toggle"
              role="switch"
              aria-checked={prefs.autoNight}
              onClick={() => onChange({ autoNight: !prefs.autoNight })}
            >
              <span className="theme-switch" aria-hidden="true" />
              Night theme from {formatHour(nightHours.from)} to {formatHour(nightHours.to)}
            </button>
          </div>
        )}

        {error ? (
          <div className="todo-error">{error}</div>
        ) : isNight && prefs.theme !== 'night' ? (
          <div className="sheet-hint">
            It's night, so the wall goes back to the Night theme when you close this. Your pick shows from{' '}
            {formatHour(nightHours!.to)}.
          </div>
        ) : null}

        <div className="sheet-actions">
          <span className="sheet-spacer" />
          <button type="button" className="sheet-button is-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
