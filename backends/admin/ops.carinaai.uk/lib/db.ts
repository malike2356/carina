import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.basename(path.dirname(__dirname)) === 'dist'
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');
dotenv.config({ path: path.join(appRoot, '.env') });

const connectionString =
  process.env.CARINA_DB_URL
  ?? (process.env.NODE_ENV === 'production'
    ? 'postgresql://carina:secret@postgres:5432/carina'
    : 'postgresql://carina:secret@localhost:5433/carina');

export const pool = new pg.Pool({ connectionString });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function tableExists(name: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name],
  );
  return Boolean(result.rows[0]?.exists);
}
