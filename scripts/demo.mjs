import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { database, migrate } from '../src/db.mjs';
import { serve } from '../src/server.mjs';
import { demoAccounts, seed } from './seed.mjs';

const path = resolve(process.env.AURORA_DEMO_DIR ?? '.aurora');
await mkdir(path, {recursive: true, mode: 0o700});
const credentialsPath = resolve(path, 'credentials.json');
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  credentials = {
    database: randomBytes(24).toString('hex'),
    accounts: Object.fromEntries(demoAccounts.map(({id}) => [id, randomBytes(15).toString('base64url')]))
  };
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
}
const port = Number(process.env.PG_DEMO_PORT ?? 55432);
const cluster = new EmbeddedPostgres({
  databaseDir: resolve(path, 'pg'), user: 'postgres', password: credentials.database, port,
  persistent: true, onLog: () => {}, onError: console.error
});
try {
  await access(resolve(path, 'pg/PG_VERSION'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await cluster.initialise();
}
await cluster.start();
const pool = database('postgresql://postgres:' + credentials.database + '@127.0.0.1:' + port + '/postgres');
try {
  await migrate(pool);
  await seed(pool, credentials.accounts);
  const origin = process.env.AURORA_ORIGIN;
  const server = await serve(pool, {
    host: origin ? '0.0.0.0' : '127.0.0.1', port: Number(process.env.PORT ?? 3000),
    secure: Boolean(origin), origin
  });
  console.log('Cuentas de prueba guardadas en ' + credentialsPath);
  async function stop() {
    await new Promise((done) => server.close(done));
    await pool.end();
    await cluster.stop();
  }
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
} catch (error) {
  await pool.end();
  await cluster.stop();
  throw error;
}
