import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { database, migrate } from './db.mjs';

export async function serve(pool, { port = 3000, host = '0.0.0.0', ...options } = {}) {
  await migrate(pool);
  const server = createServer(createApp(pool, options));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  console.log('Aurora escucha en el puerto ' + server.address().port);
  return server;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL para PostgreSQL.');
  const pool = database(process.env.DATABASE_URL);
  const secure = process.env.AURORA_INSECURE_LOCAL !== '1';
  const server = await serve(pool, {
    port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? (secure ? '0.0.0.0' : '127.0.0.1'),
    secure, origin: process.env.AURORA_ORIGIN
  });
  function stop() {
    server.close(() => { void pool.end(); });
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
