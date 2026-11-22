import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server/app.js';
import { parseConfig } from '../src/server/config.js';
import { sortTodos, TodoStore } from '../src/server/todos.js';
import type { Todo } from '../src/shared/types.js';

const TZ = 'America/Chicago';
const tmp = () => join(mkdtempSync(join(tmpdir(), 'pits-todos-')), 'todos.json');

describe('TodoStore', () => {
  it('adds, updates, ticks off and removes items, persisting to disk', async () => {
    const file = tmp();
    const store = new TodoStore({ file, timeZone: TZ });
    const milk = await store.add({ text: 'Milk', assignees: ['Cole'] });
    await store.add({ text: 'Oil change', assignees: [] });

    await store.update(milk.id, { done: true });
    const reopened = new TodoStore({ file, timeZone: TZ });
    const list = await reopened.list();
    expect(list.map((t) => [t.text, t.done])).toEqual([
      ['Milk', true],
      ['Oil change', false],
    ]);
    expect(list[0]!.doneAt).toBeDefined();

    await reopened.update(milk.id, { done: false, text: 'Oat milk' });
    expect((await reopened.list())[0]).toMatchObject({ text: 'Oat milk', done: false });
    expect((await reopened.list())[0]!.doneAt).toBeUndefined();

    expect(await reopened.remove(milk.id)).toBe(true);
    expect(await reopened.remove(milk.id)).toBe(false);
    expect(await reopened.update('nope', { done: true })).toBeNull();
    expect((await reopened.list()).map((t) => t.text)).toEqual(['Oil change']);
  });

  it('clears items finished before local midnight, but keeps today’s', async () => {
    let now = new Date('2026-11-21T22:00:00Z'); // 4pm Chicago
    const store = new TodoStore({ file: tmp(), timeZone: TZ, now: () => now });
    const a = await store.add({ text: 'done yesterday', assignees: [] });
    await store.update(a.id, { done: true });
    now = new Date('2026-11-22T05:30:00Z'); // 11:30pm Chicago, same day
    const b = await store.add({ text: 'done today', assignees: [] });
    await store.update(b.id, { done: true });
    await store.add({ text: 'still open', assignees: [] });
    expect(await store.list()).toHaveLength(3);

    now = new Date('2026-11-22T06:30:00Z'); // 12:30am Chicago, next day
    expect((await store.list()).map((t) => t.text)).toEqual(['still open']);
  });

  it('serialises concurrent writes so none are lost', async () => {
    const store = new TodoStore({ file: tmp(), timeZone: TZ });
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.add({ text: `item ${i}`, assignees: [] })));
    expect(await store.list()).toHaveLength(20);
  });

  it('moves an unreadable file aside instead of overwriting it', async () => {
    const file = tmp();
    writeFileSync(file, '{ not json');
    const logs: string[] = [];
    const store = new TodoStore({ file, timeZone: TZ, log: (m) => logs.push(m) });
    expect(await store.list()).toEqual([]);
    expect(readdirSync(join(file, '..')).some((f) => f.startsWith('todos.json.corrupt-'))).toBe(true);
    expect(logs[0]).toMatch(/unreadable/);
  });

  it('sorts open items oldest first, then finished items newest first', () => {
    const t = (text: string, createdAt: string, doneAt?: string): Todo => ({
      id: text, text, assignees: [], createdAt, done: !!doneAt, ...(doneAt ? { doneAt } : {}),
    });
    const sorted = sortTodos([
      t('done early', '2026-01-01', '2026-01-05T08:00Z'),
      t('open new', '2026-01-03'),
      t('done late', '2026-01-02', '2026-01-05T09:00Z'),
      t('open old', '2026-01-01'),
    ]);
    expect(sorted.map((x) => x.text)).toEqual(['open old', 'open new', 'done late', 'done early']);
  });
});

describe('/api/todos', () => {
  const config = parseConfig({
    location: { latitude: 1, longitude: 2 },
    timeZone: TZ,
    feeds: [{ name: 'A', color: '#112233', url: 'https://x.test/a.ics' }],
    people: [
      { name: 'Jordan', color: '#A0522D' },
      { name: 'Cole' },
    ],
  });
  const file = tmp();
  const appP = buildApp(config, { todoFile: file, clientDir: '/nonexistent' });
  afterAll(async () => (await appP).close());

  it('exposes people in settings', async () => {
    const app = await appP;
    // Only colors set in config are sent; the client fills in the theme's for the rest.
    expect((await app.inject('/api/settings')).json().people).toEqual([{ name: 'Jordan', color: '#A0522D' }, { name: 'Cole' }]);
  });

  it('creates items, normalising and ordering assignees', async () => {
    const app = await appP;
    const res = await app.inject({ method: 'POST', url: '/api/todos', payload: { text: '  RSVP to party ', assignees: ['cole', 'JORDAN', 'cole'] } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ text: 'RSVP to party', assignees: ['Jordan', 'Cole'], done: false });
    expect(JSON.parse(readFileSync(file, 'utf8')).todos).toHaveLength(1);
  });

  it('rejects empty text and unknown people', async () => {
    const app = await appP;
    const empty = await app.inject({ method: 'POST', url: '/api/todos', payload: { text: '   ' } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error).toBe('Type something first');
    const stranger = await app.inject({ method: 'POST', url: '/api/todos', payload: { text: 'x', assignees: ['Pat'] } });
    expect(stranger.json().error).toBe('Unknown person: Pat');
  });

  it('ticks off, edits and deletes items', async () => {
    const app = await appP;
    const created = (await app.inject({ method: 'POST', url: '/api/todos', payload: { text: 'Milk' } })).json();
    expect(created.assignees).toEqual([]);

    const done = await app.inject({ method: 'PATCH', url: `/api/todos/${created.id}`, payload: { done: true } });
    expect(done.json()).toMatchObject({ done: true });
    const renamed = await app.inject({ method: 'PATCH', url: `/api/todos/${created.id}`, payload: { text: 'Oat milk', assignees: ['Cole'] } });
    expect(renamed.json()).toMatchObject({ text: 'Oat milk', assignees: ['Cole'], done: true });

    const list = (await app.inject('/api/todos')).json().todos;
    expect(list.at(-1).text).toBe('Oat milk'); // finished items sort last

    expect((await app.inject({ method: 'PATCH', url: `/api/todos/${created.id}`, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/api/todos/${created.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/api/todos/${created.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: '/api/todos/missing', payload: { done: true } })).statusCode).toBe(404);
  });
});
