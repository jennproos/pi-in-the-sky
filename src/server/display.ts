import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isThemeName } from '../shared/themes.js';
import type { DisplayPrefs } from '../shared/types.js';

/**
 * Display choices made on the wall (theme, automatic night mode), saved as a small JSON
 * file so they survive reboots. Anything missing or no longer valid falls back to the
 * defaults from config.
 */
export class DisplayStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly defaults: DisplayPrefs,
  ) {}

  get(): Promise<DisplayPrefs> {
    return this.run(async () => this.load());
  }

  update(patch: Partial<DisplayPrefs>): Promise<DisplayPrefs> {
    return this.run(async () => {
      const next = { ...(await this.load()), ...patch };
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
      await rename(tmp, this.file);
      return next;
    });
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<DisplayPrefs> {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, unknown>;
    } catch {
      // Missing or unreadable: use the defaults. The next change rewrites the file.
    }
    return {
      theme: isThemeName(saved.theme) ? saved.theme : this.defaults.theme,
      autoNight: typeof saved.autoNight === 'boolean' ? saved.autoNight : this.defaults.autoNight,
    };
  }
}
