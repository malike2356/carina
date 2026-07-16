import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Schema = typeof schema;
type Db = PostgresJsDatabase<Schema>;

let client: ReturnType<typeof postgres> | null = null;
let database: Db | null = null;

export function getDb(): Db {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  client = postgres(connectionString, { max: 10 });
  database = drizzle(client, { schema });
  return database;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    if (typeof value === 'function') {
      return value.bind(real);
    }
    return Reflect.get(real, prop, receiver);
  },
});
