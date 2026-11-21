import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = (() => {
  try {
    return loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();

const app = await buildApp(config, { logger: true });
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? config.port);

try {
  await app.listen({ host, port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
