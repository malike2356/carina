#!/usr/bin/env node
/**
 * Apply Drizzle SQL migrations using runtime deps only (no drizzle-kit on VPS).
 * Usage: DATABASE_URL=... node scripts/migrate.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const migrationsFolder = path.join(rootDir, 'src/db/migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL is required');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
  console.log(`Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully');
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end({ timeout: 5 });
}
