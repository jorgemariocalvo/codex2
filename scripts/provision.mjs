import { readFile } from 'node:fs/promises';
import { database, migrate } from '../src/db.mjs';
import { seed } from './seed.mjs';

const [file] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !file) throw new Error('Configura DATABASE_URL y pasa la ruta del JSON privado con las contraseñas.');
const passwords = JSON.parse(await readFile(file, 'utf8'));
const pool = database(process.env.DATABASE_URL);
try {
  await migrate(pool);
  await seed(pool, passwords);
} finally {
  await pool.end();
}
