import { useCallback, useState } from 'react';
import type { NewTodo, Todo, TodoPatch } from '../../shared/types';
import { api } from '../api';
import { usePolling } from './usePolling';

export interface TodosState {
  todos: Todo[];
  loaded: boolean;
  /** Message for the last failed save or load, cleared on the next success. */
  error: string | null;
  add: (t: NewTodo) => Promise<boolean>;
  update: (id: string, patch: TodoPatch) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

/** Keep finished items at the bottom, matching the server's order. */
function sortLocal(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '');
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * The shared to-do list. Polls so edits made on a phone show up on the wall, and applies
 * changes optimistically so ticking an item off feels instant on the Pi.
 */
export function useTodos(intervalMs = 15_000): TodosState {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.todos().then(
      (list) => {
        setTodos(list);
        setLoaded(true);
        setError(null);
      },
      () => setError("Can't load the to-do list right now."),
    );
  }, []);

  usePolling(reload, intervalMs);

  const mutate = useCallback(
    async (optimistic: (list: Todo[]) => Todo[], call: () => Promise<unknown>): Promise<boolean> => {
      setTodos((list) => sortLocal(optimistic(list)));
      try {
        await call();
        setError(null);
        return true;
      } catch (err) {
        setError(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      } finally {
        reload();
      }
    },
    [reload],
  );

  const add = useCallback(
    (t: NewTodo) =>
      mutate(
        (list) => [...list, { id: `pending-${Date.now()}`, ...t, done: false, createdAt: new Date().toISOString() }],
        () => api.addTodo(t),
      ),
    [mutate],
  );

  const update = useCallback(
    (id: string, patch: TodoPatch) =>
      mutate(
        (list) =>
          list.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, ...patch };
            if (patch.done === true && !t.done) next.doneAt = new Date().toISOString();
            if (patch.done === false) delete next.doneAt;
            return next;
          }),
        () => api.updateTodo(id, patch),
      ),
    [mutate],
  );

  const remove = useCallback(
    (id: string) => mutate((list) => list.filter((t) => t.id !== id), () => api.removeTodo(id)),
    [mutate],
  );

  return { todos, loaded, error, add, update, remove };
}
