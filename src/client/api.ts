import type { ClientSettings, EventsResponse, NewTodo, Todo, TodoPatch, Weather } from '../shared/types';

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new Error(msg ?? `HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  todos: () => getJson<{ todos: Todo[] }>('/api/todos', 10_000).then((r) => r.todos),
  addTodo: (t: NewTodo) => send<Todo>('POST', '/api/todos', t),
  updateTodo: (id: string, patch: TodoPatch) => send<Todo>('PATCH', `/api/todos/${encodeURIComponent(id)}`, patch),
  removeTodo: (id: string) => send<void>('DELETE', `/api/todos/${encodeURIComponent(id)}`),
  settings: () => getJson<ClientSettings>('/api/settings'),
  weather: () => getJson<Weather>('/api/weather'),
  events: (start: Date, end: Date) =>
    getJson<EventsResponse>(
      `/api/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
    ),
};
