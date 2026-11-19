import { readFile } from 'node:fs/promises';
import pg from 'pg';

export const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

export function database(connectionString) {
  const pool = new pg.Pool({ connectionString });
  pool.on('error', (error) => console.error('Conexión inactiva a PostgreSQL:', error.message));
  return pool;
}

export async function migrate(pool) {
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(70101)");
    await db.query(schema);
  });
}

export async function transaction(pool, work, options = '') {
  const db = await pool.connect();
  try {
    await db.query('BEGIN ' + options);
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
