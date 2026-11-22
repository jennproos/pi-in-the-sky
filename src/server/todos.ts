import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { NewTodo, Todo, TodoPatch } from '../shared/types.js';
import { utcToWallTime, wallTimeToUtcMs } from './ics/timezone.js';

export interface TodoStoreOptions {
  /** JSON file the list is saved to. */
  file: string;
  /** Zone that defines "midnight" for clearing finished items. */
  timeZone: string;
  now?: () => Date;
  log?: (msg: string) => void;
}

/**
 * The family to-do list, saved as a JSON file. Writes go to a temp file and are renamed
 * into place so a power cut can't leave a half-written list. All operations are queued
 * so the wall and a phone editing at the same moment can't interleave.
 */
export class TodoStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly opts: TodoStoreOptions) {
    this.now = opts.now ?? (() => new Date());
  }

  list(): Promise<Todo[]> {
    return this.run(async (todos) => todos);
  }

  add(input: NewTodo): Promise<Todo> {
    return this.run(async (todos) => {
      const todo: Todo = {
        id: randomUUID(),
        text: input.text,
        assignees: input.assignees,
        done: false,
        createdAt: this.now().toISOString(),
      };
      todos.push(todo);
      return todo;
    }, true);
  }

  /** Returns the updated item, or null if it doesn't exist. */
  update(id: string, patch: TodoPatch): Promise<Todo | null> {
    return this.run(async (todos) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return null;
      if (patch.text !== undefined) todo.text = patch.text;
      if (patch.assignees !== undefined) todo.assignees = patch.assignees;
      if (patch.done !== undefined && patch.done !== todo.done) {
        todo.done = patch.done;
        if (patch.done) todo.doneAt = this.now().toISOString();
        else delete todo.doneAt;
      }
      return todo;
    }, true);
  }

  /** Returns false if the item didn't exist. */
  remove(id: string): Promise<boolean> {
    return this.run(async (todos) => {
      const i = todos.findIndex((t) => t.id === id);
      if (i === -1) return false;
      todos.splice(i, 1);
      return true;
    }, true);
  }

  /** Load, drop items finished before today, apply `fn`, and save if anything changed. */
  private run<T>(fn: (todos: Todo[]) => Promise<T>, mutates = false): Promise<T> {
    const next = this.queue.then(async () => {
      const loaded = await this.load();
      const todos = this.withoutYesterdaysDone(loaded);
      const result = await fn(todos);
      if (mutates || todos.length !== loaded.length) await this.save(todos);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private startOfToday(): number {
    const w = utcToWallTime(this.now().getTime(), this.opts.timeZone);
    return wallTimeToUtcMs({ ...w, hour: 0, minute: 0, second: 0 }, this.opts.timeZone);
  }

  private withoutYesterdaysDone(todos: Todo[]): Todo[] {
    const cutoff = this.startOfToday();
    return todos.filter((t) => !(t.done && t.doneAt && Date.parse(t.doneAt) < cutoff));
  }

  private async load(): Promise<Todo[]> {
    let text: string;
    try {
      text = await readFile(this.opts.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    try {
      const data = JSON.parse(text) as { todos?: unknown };
      if (!Array.isArray(data.todos)) throw new Error('missing "todos" array');
      return data.todos as Todo[];
    } catch (err) {
      // Keep the unreadable file for inspection rather than silently overwriting it.
      const backup = `${this.opts.file}.corrupt-${Date.now()}`;
      await rename(this.opts.file, backup);
      this.opts.log?.(`To-do file was unreadable (${(err as Error).message}); moved it to ${backup}`);
      return [];
    }
  }

  private async save(todos: Todo[]): Promise<void> {
    await mkdir(dirname(this.opts.file), { recursive: true });
    const tmp = `${this.opts.file}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, todos }, null, 2) + '\n', 'utf8');
    await rename(tmp, this.opts.file);
  }
}

/** Open items first (oldest first), then finished items (most recently finished first). */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '');
    return a.createdAt.localeCompare(b.createdAt);
  });
}
