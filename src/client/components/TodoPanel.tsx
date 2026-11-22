import { useMemo, useState, type CSSProperties } from 'react';
import type { Person, Todo } from '../../shared/types';
import type { TodosState } from '../hooks/useTodos';
import { initials, visibleFor } from '../lib/people';

interface Props {
  people: Person[];
  state: TodosState;
  onAdd?: (assignTo: string | null) => void;
  onEdit?: (todo: Todo) => void;
}

export function TodoPanel({ people, state, onAdd, onEdit }: Props) {
  const [filter, setFilter] = useState<string | null>(null);
  const labels = useMemo(() => initials(people), [people]);
  const colors = useMemo(() => new Map(people.map((p) => [p.name, p.color])), [people]);

  const shown = state.todos.filter((t) => visibleFor(filter, t.assignees));
  const open = shown.filter((t) => !t.done).length;

  return (
    <aside className="todo-panel" aria-label="To-do list">
      <div className="todo-head">
        <h2>To do</h2>
        {state.loaded && <span className="todo-count">{open === 0 ? 'All done' : `${open} left`}</span>}
      </div>

      {people.length > 0 && (
        <div className="todo-filter" role="group" aria-label="Show items for">
          <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            Everyone
          </button>
          {people.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={filter === p.name}
              onClick={() => setFilter(p.name)}
              style={{ '--person': p.color } as CSSProperties}
            >
              <span className="person-dot" aria-hidden="true" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      <ul className="todo-list">
        {shown.map((t) => (
          <li key={t.id} className={`todo${t.done ? ' is-done' : ''}`}>
            <button
              type="button"
              className="todo-check"
              aria-pressed={t.done}
              aria-label={t.done ? `Mark not done: ${t.text}` : `Mark done: ${t.text}`}
              onClick={() => void state.update(t.id, { done: !t.done })}
            >
              <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
                <circle cx="16" cy="16" r="13" />
                {t.done && <path d="M9.5 16.5l4.5 4.5 8.5-9" />}
              </svg>
            </button>
            <button type="button" className="todo-body" onClick={() => onEdit?.(t)} disabled={!onEdit}>
              <span className="todo-text">{t.text}</span>
              {t.assignees.length > 0 && (
                <span className="todo-who">
                  {t.assignees.map((name) => (
                    <span key={name} className="badge" style={{ '--person': colors.get(name) ?? '#6b6256' } as CSSProperties} title={name}>
                      {labels.get(name) ?? name.charAt(0)}
                    </span>
                  ))}
                </span>
              )}
            </button>
          </li>
        ))}
        {state.loaded && shown.length === 0 && (
          <li className="todo-empty">{filter ? `Nothing for ${filter}.` : 'Nothing to do.'} Tap Add item to start the list.</li>
        )}
      </ul>

      {state.error && <p className="todo-error">{state.error}</p>}

      {onAdd && (
        <button type="button" className="todo-add" onClick={() => onAdd(filter)}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add item
        </button>
      )}
    </aside>
  );
}
