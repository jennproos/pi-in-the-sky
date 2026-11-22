import { useState, type PointerEvent } from 'react';

export type KeyPress = { type: 'char'; char: string } | { type: 'backspace' } | { type: 'enter' };

interface Props {
  onKey: (k: KeyPress) => void;
  /** Capitalise the next letter (start of the text or a sentence). */
  autoShift: boolean;
  enterLabel: string;
  enterDisabled?: boolean;
}

const LETTERS = ['qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.?'];
const SYMBOLS = ['1234567890', '-/:;()$&@"', '!#%+=*_.,?'];

/**
 * A large touch keyboard built into the app, so typing on the wall doesn't depend on the
 * OS providing one. Keys act on pointerdown for responsiveness on the Pi.
 */
export function OnScreenKeyboard({ onKey, autoShift, enterLabel, enterDisabled }: Props) {
  const [layer, setLayer] = useState<'letters' | 'symbols'>('letters');
  const [shift, setShift] = useState<'off' | 'once' | 'lock'>('off');
  const upper = shift !== 'off' || (autoShift && layer === 'letters');
  const rows = layer === 'letters' ? LETTERS : SYMBOLS;

  const press = (e: PointerEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  const typeChar = (c: string) => {
    onKey({ type: 'char', char: upper ? c.toUpperCase() : c });
    if (shift === 'once') setShift('off');
  };

  const cycleShift = () => setShift((s) => (s === 'off' ? (autoShift ? 'lock' : 'once') : s === 'once' ? 'lock' : 'off'));

  return (
    <div className="osk" role="group" aria-label="Keyboard">
      {rows.map((row, r) => (
        <div key={r} className="osk-row">
          {r === 2 && layer === 'letters' && (
            <button
              type="button"
              className={`osk-key osk-wide${upper ? ' is-on' : ''}${shift === 'lock' ? ' is-locked' : ''}`}
              aria-label="Shift"
              aria-pressed={upper}
              onPointerDown={(e) => press(e, cycleShift)}
            >
              ⇧
            </button>
          )}
          {[...row].map((c) => (
            <button key={c} type="button" className="osk-key" onPointerDown={(e) => press(e, () => typeChar(c))}>
              {upper ? c.toUpperCase() : c}
            </button>
          ))}
          {r === 0 && (
            <button
              type="button"
              className="osk-key osk-wide"
              aria-label="Backspace"
              onPointerDown={(e) => press(e, () => onKey({ type: 'backspace' }))}
            >
              ⌫
            </button>
          )}
        </div>
      ))}
      <div className="osk-row">
        <button
          type="button"
          className="osk-key osk-wide"
          onPointerDown={(e) => press(e, () => setLayer((l) => (l === 'letters' ? 'symbols' : 'letters')))}
        >
          {layer === 'letters' ? '123' : 'ABC'}
        </button>
        <button type="button" className="osk-key osk-space" aria-label="Space" onPointerDown={(e) => press(e, () => onKey({ type: 'char', char: ' ' }))}>
          space
        </button>
        <button
          type="button"
          className="osk-key osk-enter"
          disabled={enterDisabled}
          onPointerDown={(e) => press(e, () => !enterDisabled && onKey({ type: 'enter' }))}
        >
          {enterLabel}
        </button>
      </div>
    </div>
  );
}
