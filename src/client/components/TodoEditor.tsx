import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { NewTodo, Person } from '../../shared/types';
import { OnScreenKeyboard, type KeyPress } from './OnScreenKeyboard';

export const MAX_TODO_LENGTH = 200;

interface Props {
  mode: 'add' | 'edit';
  initial: NewTodo;
  people: Person[];
  /** 'onscreen' for the wall; 'native' for phones, which have their own keyboard. */
  keyboard: 'onscreen' | 'native';
  onSave: (t: NewTodo) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/** Add or edit a to-do: text, who it's for, and (when editing) delete. */
export function TodoEditor({ mode, initial, people, keyboard, onSave, onDelete, onCancel }: Props) {
  const [text, setText] = useState(initial.text);
  const [assignees, setAssignees] = useState<string[]>(initial.assignees);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canSave = text.trim().length > 0;
  const saveLabel = mode === 'add' ? 'Add item' : 'Save';

  const save = () => {
    if (!canSave) return;
    // Keep people in config order so "both" always reads the same way.
    onSave({ text: text.trim(), assignees: people.map((p) => p.name).filter((n) => assignees.includes(n)) });
  };

  const onKey = (k: KeyPress) => {
    if (k.type === 'enter') return save();
    if (k.type === 'backspace') return setText((t) => t.slice(0, -1));
    setText((t) => (t.length >= MAX_TODO_LENGTH ? t : t + k.char));
  };

  // A physical keyboard also works with the on-screen editor (handy on a laptop).
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    if (keyboard !== 'onscreen') return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') cancelRef.current();
      else if (e.key === 'Enter') onKeyRef.current({ type: 'enter' });
      else if (e.key === 'Backspace') onKeyRef.current({ type: 'backspace' });
      else if (e.key.length === 1) onKeyRef.current({ type: 'char', char: e.key });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboard]);

  // Two taps to delete, so a stray touch can't lose an item.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const toggle = (name: string) =>
    setAssignees((a) => (a.includes(name) ? a.filter((n) => n !== name) : [...a, name]));

  const autoShift = text.length === 0 || /[.!?]\s$/.test(text);

  return (
    <div className={`sheet-backdrop is-${keyboard}`} onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'add' ? 'Add a to-do' : 'Edit to-do'}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 className="sheet-title">{mode === 'add' ? 'New to-do' : 'Edit to-do'}</h2>

        {keyboard === 'native' ? (
          <input
            className="sheet-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TODO_LENGTH))}
            placeholder="What needs doing?"
            autoFocus
            enterKeyHint="done"
            aria-label="To-do"
          />
        ) : (
          <div className="sheet-input sheet-display" role="textbox" aria-label="To-do" aria-readonly="false">
            {text ? <span>{text}</span> : <span className="placeholder">What needs doing?</span>}
            <span className="caret" aria-hidden="true" />
          </div>
        )}

        {people.length > 0 && (
          <div className="sheet-people" role="group" aria-label="Who is it for?">
            <span className="sheet-label">For</span>
            {people.map((p) => (
              <button
                key={p.name}
                type="button"
                className="person-toggle"
                aria-pressed={assignees.includes(p.name)}
                onClick={() => toggle(p.name)}
                style={{ '--person': p.color } as CSSProperties}
              >
                {p.name}
              </button>
            ))}
            <span className="sheet-hint">{assignees.length === 0 ? 'Anyone' : assignees.length === people.length && people.length > 1 ? 'Everyone' : ''}</span>
          </div>
        )}

        {keyboard === 'onscreen' && (
          <OnScreenKeyboard onKey={onKey} autoShift={autoShift} enterLabel={saveLabel} enterDisabled={!canSave} />
        )}

        <div className="sheet-actions">
          <button type="button" className="sheet-button" onClick={onCancel}>
            Cancel
          </button>
          <span className="sheet-spacer" />
          {onDelete && (
            <button
              type="button"
              className={`sheet-button is-danger${confirmDelete ? ' is-confirming' : ''}`}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          {keyboard === 'native' && (
            <button type="submit" className="sheet-button is-primary" disabled={!canSave}>
              {saveLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
